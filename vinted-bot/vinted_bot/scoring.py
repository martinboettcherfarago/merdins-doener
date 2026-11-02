"""Filter und Deal-Bewertung: Wie gut ist ein Angebot (0-100)?"""

from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass, field
from statistics import median
from typing import Iterable, Optional, Union

from .catalog import TYPE_LABELS as CATALOG_LABELS
from .catalog import Estimate, product_type  # noqa: F401  (product_type wird von anderen Modulen importiert)
from .config import SearchConfig
from .knowledge import TREND_POINTS, TREND_PREMIUM, Rarity
from .models import Item
from .text import normalize, rx  # noqa: F401

# Zustand -> Punkte (max. 20). Längere Schlüssel zuerst, damit "sehr gut" nicht als "gut" zählt.
CONDITION_POINTS = [
    ("neu mit etikett", 20), ("new with tags", 20), ("neuf avec étiquette", 20),
    ("neu ohne etikett", 17), ("new without tags", 17), ("neuf sans étiquette", 17),
    ("sehr gut", 14), ("very good", 14), ("très bon", 14),
    ("zufriedenstellend", 4), ("satisfactory", 4), ("satisfaisant", 4),
    ("gut", 9), ("good", 9), ("bon", 9),
]
UNKNOWN_CONDITION_POINTS = 8

# Produkttypen & Namen kommen aus dem Katalog (catalog.py) – hier nur weitergereicht
TYPE_LABELS = CATALOG_LABELS

MIN_GROUP_SAMPLES = 5     # so viele Vergleichspreise braucht eine Gruppe (Marke + Produkttyp)
MIN_SEARCH_SAMPLES = 8    # so viele Preise braucht eine ganze Suche
PRIOR_WEIGHT = 5          # ein Startwert aus dem Vorwissen zählt wie 5 echte Preise
PRIOR_UNTIL = 30          # ab so vielen echten Vergleichspreisen zählen nur noch echte Daten
RARITY_POINTS = {0: 0, 1: 6, 2: 10, 3: 15}


def price_group(search: SearchConfig, item: Item) -> str:
    """Vergleichsgruppe für den Marktpreis.

    Resale (ganze Marke): Marke + Produkttyp, über alle Suchen hinweg -> "b:carhartt|jacke".
    Normale Suche: innerhalb dieser Suche nach Produkttyp -> "s:Air Max 90|schuhe".
    """
    ptype = product_type(item.title)
    if search.is_resale:
        from .knowledge import brand_key, item_brand
        brand = brand_key(item_brand(item)) or brand_key(search.brands[0] if search.brands else "") or "ohne"
        return f"b:{brand}|{ptype}"
    return f"s:{search.name}|{ptype}"


@dataclass
class Reference:
    price: Optional[float]
    basis: str = ""
    samples: int = 0
    prices: list[float] = field(default_factory=list)  # die Vergleichspreise (für den Preis-Rang)


@dataclass
class DealScore:
    total: int
    reference_price: Optional[float]
    discount: Optional[float]  # 0.3 = 30 % unter Referenzpreis
    is_top: bool
    reasons: list[str] = field(default_factory=list)
    profit: Optional[float] = None       # geschätzter Gewinn beim Weiterverkauf zum Marktpreis
    age_minutes: Optional[float] = None
    cheaper_than: Optional[float] = None  # 0.95 = günstiger als 95 % der Vergleichsangebote
    rarity_level: int = 0
    rarity_tags: list[str] = field(default_factory=list)
    value: Optional[float] = None         # geschätzter Wert dieses Artikels (inkl. Zustand, Rarität …)
    confidence: str = "mittel"            # wie sicher die Schätzung ist: hoch / mittel / niedrig
    trend: Optional[str] = None
    fake_suspect: bool = False


def _contains_word(text: str, word: str) -> bool:
    return rx(rf"(?<!\w){re.escape(word.lower())}(?!\w)").search(text) is not None


def brand_matches(item: Item, brands: Iterable[str]) -> bool:
    """Strenger Markenabgleich: zählt die Marke des Artikels, nicht nur ein Wort im Titel.

    Hat der Verkäufer keine echte Marke gewählt ("Vintage", "Andere", "Ohne Marke"), zählt der Titel.
    """
    from .catalog import NO_BRAND, NO_BRAND_EXPLICIT, _STYLE_COPY
    item_brand = normalize(item.brand)
    if item_brand in NO_BRAND_EXPLICIT or (item_brand in NO_BRAND and _STYLE_COPY.search(item.title.lower())):
        return False  # "No Name" bzw. "im Carhartt Style" ist keine Carhartt
    if item_brand in NO_BRAND:
        item_brand = ""  # "Vintage"/"Andere" gewählt -> der Titel entscheidet
    for want in brands:
        w = normalize(want)
        if not w:
            continue
        if item_brand:
            if w in item_brand or (len(item_brand) >= 3 and item_brand in w):
                return True
        elif _contains_word(item.title.lower(), want.lower()) or w in normalize(item.title):
            return True
    return False


_NEGATIONS = r"(?:kein|keine|keinen|keiner|nicht|ohne|no|not|non|null|0)"
_NEGATED = re.compile(rf"(?<!\w){_NEGATIONS}\W+(?:\w+\W+)?$")
_WANTED_AD = re.compile(r"^\s*(?:ich\s+)?(?:suche|gesucht|wtb|looking for)\b|\bsuche\s+(?:nach|dringend)\b")
_SWAP_ONLY = re.compile(r"\bnur\s+(?:zum\s+)?tausch|\btausch(?:e)?\s+gegen\b|\bzum\s+tausch\b|\bnur\s+tauschen\b")


def excluded_by(title: str, word: str) -> bool:
    """Schließt das Wort den Artikel wirklich aus? 'kein Fake', 'ohne Defekte', 'Tausch möglich' zählen nicht."""
    w = word.lower().strip()
    if not w:
        return False
    if w in ("suche", "gesucht"):
        return _WANTED_AD.search(title) is not None        # nur echte Suchanzeigen
    if w in ("tausch", "nur tausch"):
        return _SWAP_ONLY.search(title) is not None         # nur reine Tausch-Angebote
    for m in rx(rf"(?<!\w){re.escape(w)}(?!\w)").finditer(title):
        before = title[max(0, m.start() - 20):m.start()]
        if not _NEGATED.search(before):
            return True                                      # nicht verneint -> ausschließen
    return False


def passes_filters(item: Item, search: SearchConfig, global_excludes: Iterable[str]) -> tuple[bool, str]:
    """Prüft die persönlichen Filter. Gibt (ok, Grund) zurück."""
    title = item.title.lower()
    haystack = f"{title} {item.brand.lower()}"
    if search.min_price is not None and item.price < search.min_price:
        return False, "zu billig"
    if search.max_price is not None and item.price > search.max_price:
        return False, "zu teuer"
    for word in list(global_excludes) + search.exclude_words:
        if word and excluded_by(title, word):
            return False, f"Ausschlusswort '{word}'"
    for word in search.must_contain:
        if not _contains_word(haystack, word):
            return False, f"'{word}' fehlt"
    if search.brands and not brand_matches(item, search.brands):
        return False, "andere Marke"
    if search.sizes:
        from .knowledge import size_matches  # versteht auch "M / 38 / 10", "W30 L32", "38"
        if not size_matches(item.size, search.sizes):
            return False, "andere Größe"
    if search.min_condition and item.condition:
        if condition_points(item.condition) < condition_points(search.min_condition):
            return False, "Zustand zu schlecht"
    return True, ""


def market_reference(search: SearchConfig, group_prices: list[float], search_prices: list[float],
                     group_label: str = "ähnliche Angebote", prior: Optional[float] = None,
                     own_price: Optional[float] = None) -> Reference:
    """Marktpreis: deine Angabe > Median gleicher Artikel (Marke + Typ) > Median der ganzen Suche.

    Bei Resale-Suchen über eine ganze Marke wird nie über alle Produkttypen gemittelt –
    lieber kein Vergleich als ein falscher "Deal".
    """
    n = len(group_prices)
    rank_prices = list(group_prices) if n >= MIN_GROUP_SAMPLES else []
    if search.market_price:
        return Reference(float(search.market_price), "dein Marktpreis", 0)
    if own_price:  # per /preis beigebracht
        return Reference(float(own_price), "dein Marktpreis", n, rank_prices)
    if prior and n < PRIOR_UNTIL:  # Vorwissen mit echten Preisen mischen
        if n == 0:
            return Reference(float(prior), "Startwert aus dem Vorwissen", 0, [])
        blended = (n * median(group_prices) + PRIOR_WEIGHT * prior) / (n + PRIOR_WEIGHT)
        return Reference(float(blended), f"{n} {group_label} + Vorwissen", n, rank_prices)
    if n >= MIN_GROUP_SAMPLES:
        return Reference(float(median(group_prices)), f"{len(group_prices)} {group_label}", len(group_prices),
                         list(group_prices))
    if not search.is_resale and len(search_prices) >= MIN_SEARCH_SAMPLES:
        return Reference(float(median(search_prices)), f"{len(search_prices)} Angebote dieser Suche",
                         len(search_prices), list(search_prices))
    return Reference(None)


def reference_price(market_price: Optional[float], history: list[float], min_samples: int = MIN_SEARCH_SAMPLES
                    ) -> Optional[float]:
    """Einfache Variante: Marktpreis aus der Config, sonst Median der Preise."""
    if market_price:
        return float(market_price)
    if len(history) >= min_samples:
        return float(median(history))
    return None


def condition_points(condition: str) -> int:
    c = (condition or "").lower().strip()
    if not c:
        return UNKNOWN_CONDITION_POINTS
    for key, pts in CONDITION_POINTS:
        if c == key:
            return pts
    for key, pts in CONDITION_POINTS:
        if key in c:
            return pts
    return UNKNOWN_CONDITION_POINTS


def _fresh_points(age_min: Optional[float], resale: bool) -> float:
    if resale:  # beim Weiterverkaufen zählt jede Minute (max. 25)
        steps = [(2, 25), (5, 20), (10, 14), (30, 6)]
        unknown = 8
    else:       # max. 10
        steps = [(5, 10), (15, 7), (60, 4)]
        unknown = 5
    if age_min is None:
        return unknown
    for limit, pts in steps:
        if age_min <= limit:
            return pts
    return 0


def score_item(item: Item, ref: Union[Reference, float, None], top_threshold: int = 75,
               now: Optional[float] = None, resale: bool = False, shipping: float = 0.0,
               rare: Optional[Rarity] = None, pref_pts: float = 0.0, est: Optional[Estimate] = None,
               trend: Optional[str] = None) -> DealScore:
    """Deal-Score 0-100.

    Standard: Preis 60 · Zustand 20 · Frische 10 · Beliebtheit 10
    Resale:   Preis 55 · Frische 25 · Zustand 10 · Beliebtheit 10 (nur große Rabatte zählen)
    """
    if not isinstance(ref, Reference):
        ref = Reference(float(ref), "", 0) if ref else Reference(None)
    now = now if now is not None else time.time()
    reasons: list[str] = []
    sym = _sym(item.currency)
    rare = rare or Rarity()

    # 1) Wert schätzen: Marktpreis × Zustand/Kindergröße × Rarität bzw. Trend
    discount = profit = None
    notes = list(est.factor_notes) if est else []
    factor = est.factor if est else 1.0
    if rare.premium > 1:
        factor *= rare.premium
        notes.append(f"Rarität +{rare.premium - 1:.0%}")
    elif trend:
        factor *= TREND_PREMIUM
        notes.append(f"Trend +{TREND_PREMIUM - 1:.0%}")
    value = ref.price * factor if ref.price else None
    if rare.level:
        reasons.append(f"💎 Rarität: {' · '.join(rare.tags)}")
    if trend:
        reasons.append(f"🔥 Trend: {trend}")
    if value and value > 0:
        discount = 1 - item.price / value
        if resale:
            price_pts = max(0.0, min(55.0, discount / 0.6 * 55))
        else:
            price_pts = max(0.0, min(60.0, 20 + discount * 80))
        basis = f" · {ref.basis}" if ref.basis else ""
        if notes:
            basis += f" · {', '.join(notes)} → Wert ca. {value:.0f} {sym}"
        under = "Marktpreis" if factor == 1 else "geschätztem Wert"
        if discount >= 0.05:
            reasons.append(f"{discount:.0%} unter {under} (Ø {ref.price:.0f} {sym}{basis})")
        elif discount <= -0.1:
            reasons.append(f"{-discount:.0%} über Marktpreis (Ø {ref.price:.0f} {sym}{basis})")
        else:
            reasons.append(f"fairer Preis (Ø {ref.price:.0f} {sym}{basis})")
        profit = value - (item.total_price or item.price) - shipping
    else:
        price_pts = 15.0 if resale else 25.0
        reasons.append("noch zu wenig Preisdaten für einen Vergleich")

    # Preis-Rang: Wie viele vergleichbare Angebote sind teurer?
    cheaper_than = None
    # Ausreißer nach unten (Fakes, Fehlkategorien, "Tausch"-Angebote) zählen beim Rang nicht mit
    comparable = [p for p in ref.prices if not ref.price or p >= 0.3 * ref.price]
    if comparable:
        cheaper_than = sum(1 for p in comparable if p > item.price) / len(comparable)
        if cheaper_than >= 1.0:
            reasons.append(f"billigstes von {len(comparable)} vergleichbaren Angeboten 🏆")
        elif cheaper_than >= 0.5:
            reasons.append(f"günstiger als {cheaper_than:.0%} von {len(comparable)} vergleichbaren Angeboten")

    # 2) Zustand
    cond_pts = condition_points(item.condition) / (2 if resale else 1)

    # 3) Frische: wer zuerst kommt, kauft zuerst
    age_min = (now - item.created_ts) / 60 if item.created_ts else None
    fresh_pts = _fresh_points(age_min, resale)

    # 4) Beliebtheit: viele Favoriten kurz nach dem Einstellen = begehrt (max. 10)
    if age_min is not None and age_min <= 120:
        pop_pts = min(10, item.favourites * 2)
    else:
        pop_pts = min(5, item.favourites)
    if pop_pts >= 6:
        reasons.append(f"schon {item.favourites} Favoriten – schnell sein!")

    # 5) Raritäten-/Trend-Bonus und deine Vorlieben (👍/👎)
    rare_pts = RARITY_POINTS.get(rare.level, 0) + (TREND_POINTS if trend else 0)

    # 6) Fake-Verdacht: Luxus/Designer viel zu billig
    fake = False
    if est and est.tier in ("luxus", "designer") and discount is not None and discount >= 0.75:
        fake = True
        rare_pts -= 15
        reasons.append(f"⚠️ Fake-Risiko: für {est.brand or 'diese Marke'} sehr billig – Echtheit genau prüfen!")

    # Wie sicher ist die Schätzung?
    confidence = est.confidence if est else "mittel"
    if ref.basis == "dein Marktpreis" or ref.samples >= 15:
        confidence = "hoch"
    elif ref.samples >= 5 and confidence == "niedrig":
        confidence = "mittel"
    if pref_pts >= 3:
        reasons.append("👍 passt zu deinen Vorlieben")
    elif pref_pts <= -3:
        reasons.append("👎 eher nicht dein Geschmack")

    total = max(0, min(100, int(round(price_pts + cond_pts + fresh_pts + pop_pts + rare_pts + pref_pts))))
    return DealScore(total=total, reference_price=ref.price, discount=discount, is_top=total >= top_threshold,
                     reasons=reasons, profit=profit, age_minutes=age_min, cheaper_than=cheaper_than,
                     rarity_level=rare.level, rarity_tags=list(rare.tags), value=value, confidence=confidence,
                     trend=trend, fake_suspect=fake)


def meets_targets(search: SearchConfig, score: DealScore) -> tuple[bool, str]:
    """Harte Ziele einer Suche: Mindest-Score, -Rabatt, Preis-Rang und Mindest-Gewinn."""
    if score.total < search.min_score:
        return False, "Score zu niedrig"
    needs_price = search.min_discount is not None or search.min_profit is not None or search.is_resale
    if needs_price and score.reference_price is None:
        return False, "Marktpreis noch unbekannt"
    if score.fake_suspect and (score.discount or 0) >= 0.85:
        return False, "Fake-Verdacht (viel zu billig für die Marke)"
    if search.min_discount is not None:
        # unsichere Schätzung (No-Name, Elektronik …) -> lieber mehr Abstand zum Schätzwert verlangen
        needed = search.min_discount + (15 if score.confidence == "niedrig" else 0)
        if (score.discount or 0) * 100 < needed:
            return False, "Rabatt zu klein" + (" (unsichere Schätzung)" if score.confidence == "niedrig" else "")
    if search.min_cheaper_than is not None and score.cheaper_than is not None:
        # Raritäten werden mit normalen Teilen verglichen – da reicht ein etwas schwächerer Rang
        needed = search.min_cheaper_than if not score.rarity_level else max(50.0, search.min_cheaper_than - 30)
        if score.cheaper_than * 100 < needed:
            return False, "nicht günstig genug im Vergleich"
    if search.min_profit is not None and (score.profit or 0) < search.min_profit:
        return False, "Gewinn zu klein"
    return True, ""


def _sym(currency: str) -> str:
    return {"EUR": "€", "GBP": "£", "USD": "$", "PLN": "zł", "CZK": "Kč"}.get(currency, currency)


def suggest_offers(price: float, discounts: Iterable[int]) -> list[float]:
    """Angebotspreise (Vinted erlaubt höchstens 40 % Nachlass)."""
    out = []
    for d in discounts:
        d = max(1, min(40, int(d)))
        p = round(price * (1 - d / 100))  # glatte Beträge wirken natürlicher
        p = max(p, math.ceil(price * 0.6))
        if 1 <= p < price and p not in out:
            out.append(float(p))
    return out
