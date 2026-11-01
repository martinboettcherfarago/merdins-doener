"""Filter und Deal-Bewertung: Wie gut ist ein Angebot (0-100)?"""

from __future__ import annotations

import math
import re
import time
import unicodedata
from dataclasses import dataclass, field
from statistics import median
from typing import Iterable, Optional, Union

from .config import SearchConfig
from .models import Item

# Zustand -> Punkte (max. 20). Längere Schlüssel zuerst, damit "sehr gut" nicht als "gut" zählt.
CONDITION_POINTS = [
    ("neu mit etikett", 20), ("new with tags", 20), ("neuf avec étiquette", 20),
    ("neu ohne etikett", 17), ("new without tags", 17), ("neuf sans étiquette", 17),
    ("sehr gut", 14), ("very good", 14), ("très bon", 14),
    ("zufriedenstellend", 4), ("satisfactory", 4), ("satisfaisant", 4),
    ("gut", 9), ("good", 9), ("bon", 9),
]
UNKNOWN_CONDITION_POINTS = 8

# Produkttyp aus dem Titel, damit eine Mütze nicht mit einer Jacke verglichen wird.
# Erster Treffer gewinnt. "=wort" heißt: muss am Wortanfang stehen (sonst z. B. "cap" in "Capri").
PRODUCT_TYPES: list[tuple[str, list[str]]] = [
    ("shorts", ["shorts", "kurze hose", "bermuda"]),
    ("hoodie", ["hoodie", "hoody", "kapuzen"]),
    ("fleece", ["fleece"]),
    ("weste", ["weste", "=vest", "gilet", "bodywarmer"]),
    ("pullover", ["sweatjacke", "strickjacke", "cardigan"]),
    ("jacke", ["jacke", "jacket", "parka", "mantel", "=coat", "anorak", "windbreaker", "puffer", "daunen",
               "blouson", "bomber", "softshell", "hardshell", "overcoat"]),
    ("pullover", ["pullover", "pulli", "sweatshirt", "sweater", "strick", "crewneck", "=knit", "quarter zip",
                  "half zip", "troyer"]),
    ("hemd", ["hemd", "overshirt", "flanell", "button down"]),
    ("tshirt", ["t-shirt", "tshirt", "=tee", "=shirt", "longsleeve", "=polo", "tanktop", "trikot", "jersey"]),
    ("hose", ["jeans", "hose", "=pants", "trousers", "cargo", "chino", "jogger", "trackpants", "=501"]),
    ("schuhe", ["sneaker", "schuh", "=shoes", "trainers", "=boots", "stiefel", "air max", "air force", "=dunk",
                "=samba", "gazelle", "spezial", "=campus", "yeezy", "jordan", "=gel-", "xt-6", "=990", "=2002r",
                "=9060", "loafer", "clogs", "slides"]),
    ("tasche", ["tasche", "=bag", "rucksack", "backpack", "beutel", "geldbörse", "portemonnaie", "=wallet"]),
    ("muetze", ["=cap", "mütze", "muetze", "beanie", "=hat", "=hut", "kappe", "bucket"]),
    ("kleid", ["kleid", "=dress"]),
    ("rock", ["=rock", "skirt"]),
    ("schmuck", ["kette", "=ring", "armband", "ohrring", "necklace", "bracelet"]),
    ("uhr", ["=uhr", "armbanduhr", "=watch"]),
    ("guertel", ["gürtel", "guertel", "=belt"]),
    ("schal", ["schal", "scarf"]),
    ("brille", ["brille", "sunglasses"]),
]
TYPE_LABELS = {
    "shorts": "Shorts", "hoodie": "Hoodies", "fleece": "Fleece", "weste": "Westen", "pullover": "Pullover",
    "jacke": "Jacken", "hemd": "Hemden", "tshirt": "Shirts", "hose": "Hosen", "schuhe": "Schuhe",
    "tasche": "Taschen", "muetze": "Mützen/Caps", "kleid": "Kleider", "rock": "Röcke", "schmuck": "Schmuck",
    "uhr": "Uhren", "guertel": "Gürtel", "schal": "Schals", "brille": "Brillen", "sonstiges": "Artikel",
}

MIN_GROUP_SAMPLES = 5     # so viele Vergleichspreise braucht eine Gruppe (Marke + Produkttyp)
MIN_SEARCH_SAMPLES = 8    # so viele Preise braucht eine ganze Suche


def normalize(text: str) -> str:
    """'Arc'teryx' -> 'arcteryx', 'Stüssy' -> 'stussy', 'Levi's' -> 'levis'."""
    t = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", t.lower())


def product_type(title: str) -> str:
    t = (title or "").lower()
    for ptype, words in PRODUCT_TYPES:
        for w in words:
            if w.startswith("="):
                if re.search(rf"(?<![a-zäöüß0-9]){re.escape(w[1:])}", t):
                    return ptype
            elif w in t:
                return ptype
    return "sonstiges"


def price_group(search: SearchConfig, item: Item) -> str:
    """Vergleichsgruppe für den Marktpreis.

    Resale (ganze Marke): Marke + Produkttyp, über alle Suchen hinweg -> "b:carhartt|jacke".
    Normale Suche: innerhalb dieser Suche nach Produkttyp -> "s:Air Max 90|schuhe".
    """
    ptype = product_type(item.title)
    if search.is_resale:
        brand = normalize(item.brand) or normalize(search.brands[0] if search.brands else search.name)
        return f"b:{brand}|{ptype}"
    return f"s:{search.name}|{ptype}"


@dataclass
class Reference:
    price: Optional[float]
    basis: str = ""
    samples: int = 0


@dataclass
class DealScore:
    total: int
    reference_price: Optional[float]
    discount: Optional[float]  # 0.3 = 30 % unter Referenzpreis
    is_top: bool
    reasons: list[str] = field(default_factory=list)
    profit: Optional[float] = None       # geschätzter Gewinn beim Weiterverkauf zum Marktpreis
    age_minutes: Optional[float] = None


def _contains_word(text: str, word: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(word.lower())}(?!\w)", text) is not None


def brand_matches(item: Item, brands: Iterable[str]) -> bool:
    """Strenger Markenabgleich: zählt die Marke des Artikels, nicht nur ein Wort im Titel."""
    item_brand = normalize(item.brand)
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


def passes_filters(item: Item, search: SearchConfig, global_excludes: Iterable[str]) -> tuple[bool, str]:
    """Prüft die persönlichen Filter. Gibt (ok, Grund) zurück."""
    title = item.title.lower()
    haystack = f"{title} {item.brand.lower()}"
    if search.min_price is not None and item.price < search.min_price:
        return False, "zu billig"
    if search.max_price is not None and item.price > search.max_price:
        return False, "zu teuer"
    for word in list(global_excludes) + search.exclude_words:
        if word and _contains_word(title, word):
            return False, f"Ausschlusswort '{word}'"
    for word in search.must_contain:
        if not _contains_word(haystack, word):
            return False, f"'{word}' fehlt"
    if search.brands and not brand_matches(item, search.brands):
        return False, "andere Marke"
    if search.sizes:
        size = item.size.lower().strip()
        wanted = {s.lower().strip() for s in search.sizes}
        # "M / 38 / 10" soll auch bei Wunschgröße "M" passen
        parts = {p.strip() for p in re.split(r"[/|,]", size)} | {size}
        if not parts & wanted:
            return False, "andere Größe"
    if search.min_condition and item.condition:
        if condition_points(item.condition) < condition_points(search.min_condition):
            return False, "Zustand zu schlecht"
    return True, ""


def market_reference(search: SearchConfig, group_prices: list[float], search_prices: list[float],
                     group_label: str = "ähnliche Angebote") -> Reference:
    """Marktpreis: deine Angabe > Median gleicher Artikel (Marke + Typ) > Median der ganzen Suche.

    Bei Resale-Suchen über eine ganze Marke wird nie über alle Produkttypen gemittelt –
    lieber kein Vergleich als ein falscher "Deal".
    """
    if search.market_price:
        return Reference(float(search.market_price), "dein Marktpreis", 0)
    if len(group_prices) >= MIN_GROUP_SAMPLES:
        return Reference(float(median(group_prices)), f"{len(group_prices)} {group_label}", len(group_prices))
    if not search.is_resale and len(search_prices) >= MIN_SEARCH_SAMPLES:
        return Reference(float(median(search_prices)), f"{len(search_prices)} Angebote dieser Suche",
                         len(search_prices))
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
               now: Optional[float] = None, resale: bool = False, shipping: float = 0.0) -> DealScore:
    """Deal-Score 0-100.

    Standard: Preis 60 · Zustand 20 · Frische 10 · Beliebtheit 10
    Resale:   Preis 55 · Frische 25 · Zustand 10 · Beliebtheit 10 (nur große Rabatte zählen)
    """
    if not isinstance(ref, Reference):
        ref = Reference(float(ref), "", 0) if ref else Reference(None)
    now = now if now is not None else time.time()
    reasons: list[str] = []
    sym = _sym(item.currency)

    # 1) Preis im Vergleich zum Markt
    discount = profit = None
    if ref.price and ref.price > 0:
        discount = 1 - item.price / ref.price
        if resale:
            price_pts = max(0.0, min(55.0, discount / 0.6 * 55))
        else:
            price_pts = max(0.0, min(60.0, 20 + discount * 80))
        basis = f" · {ref.basis}" if ref.basis else ""
        if discount >= 0.05:
            reasons.append(f"{discount:.0%} unter Marktpreis (Ø {ref.price:.0f} {sym}{basis})")
        elif discount <= -0.1:
            reasons.append(f"{-discount:.0%} über Marktpreis (Ø {ref.price:.0f} {sym}{basis})")
        else:
            reasons.append(f"fairer Preis (Ø {ref.price:.0f} {sym}{basis})")
        profit = ref.price - (item.total_price or item.price) - shipping
    else:
        price_pts = 15.0 if resale else 25.0
        reasons.append("noch zu wenig Preisdaten für einen Vergleich")

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

    total = max(0, min(100, int(round(price_pts + cond_pts + fresh_pts + pop_pts))))
    return DealScore(total=total, reference_price=ref.price, discount=discount, is_top=total >= top_threshold,
                     reasons=reasons, profit=profit, age_minutes=age_min)


def meets_targets(search: SearchConfig, score: DealScore) -> tuple[bool, str]:
    """Harte Ziele einer Suche: Mindest-Rabatt, Mindest-Gewinn, Mindest-Score."""
    if score.total < search.min_score:
        return False, "Score zu niedrig"
    needs_price = search.min_discount is not None or search.min_profit is not None or search.is_resale
    if needs_price and score.reference_price is None:
        return False, "Marktpreis noch unbekannt"
    if search.min_discount is not None and (score.discount or 0) * 100 < search.min_discount:
        return False, "Rabatt zu klein"
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
