"""Musterdaten & Probelauf: zeigt ohne Vinted-Zugriff, was der Bot melden würde – und was nicht.

Der Datensatz ist künstlich, aber realistisch aufgebaut: ein "Markt" aus normalen Angeboten
mehrerer Marken (Preise rund um typische Wiederverkaufspreise) und frisch hochgeladene Artikel.
Darunter sind echte Finds (z. B. vintage Carhartt Detroit für 45 €) und typische Fallen
(Schuhe, Fakes, falsche Größe, Kindergrößen, defekte Teile, normale Preise, alte Artikel).
"""

from __future__ import annotations

import html
import logging
import random
import time
from dataclasses import dataclass, field, replace
from typing import Any, Optional

from .config import Config, SearchConfig
from .catalog import estimate, product_type
from .knowledge import prior_price
from .models import Item, parse_item
from .notify import Alert, money
from .storage import Storage

BASE = "https://www.vinted.de"
SAMPLE_BRANDS = ["Carhartt", "Stüssy", "Arc'teryx", "Stone Island", "Ralph Lauren", "The North Face",
                 "Patagonia", "Nike", "Miu Miu", "Abercrombie & Fitch", "Adidas"]
# Trend-Suchen nach Begriff (keine Marke): Markt aus verschiedenen Marken und No-Name
SAMPLE_TERMS = {"Vintage Lederjacke": ("lederjacke", ["", "", "", "Zara", "H&M", "Mango", "Levi's", "Gipsy"]),
                "Vintage 90er": ("jacke", ["", "", "Vintage", "Nike", "Adidas", "Puma", "Kappa", "C&A"])}
TITLES = {
    "jacke": ["Jacke", "Jacket", "Winterjacke", "Übergangsjacke"],
    "hoodie": ["Hoodie", "Kapuzenpullover"],
    "pullover": ["Pullover", "Sweatshirt", "Strickpullover"],
    "tshirt": ["T-Shirt", "Tee", "Longsleeve"],
    "hose": ["Hose", "Jeans", "Cargo Hose"],
    "weste": ["Weste"],
    "fleece": ["Fleece Pullover", "Fleece"],
    "muetze": ["Mütze", "Cap", "Beanie"],
    "schuhe": ["Sneaker", "Schuhe"],
    "tasche": ["Tasche", "Handtasche", "Shopper"],
    "rock": ["Rock", "Minirock"],
    "lederjacke": ["Lederjacke", "Vintage Lederjacke", "Bikerjacke"],
    "top": ["Top", "Crop Top", "Spitzen Top"],
}
# Welche Kategorien eine Marke im Musterdatensatz anbietet
BRAND_TYPES = {"Nike": ["schuhe", "jacke", "hoodie", "pullover", "tshirt", "hose", "muetze"],
               "Miu Miu": ["tasche", "rock", "pullover", "tshirt", "jacke"],
               "Abercrombie & Fitch": ["jacke", "hoodie", "pullover", "tshirt", "top", "hose"],
               "Adidas": ["schuhe", "jacke", "hoodie", "pullover", "tshirt", "hose"]}
DEFAULT_TYPES = ["jacke", "hoodie", "pullover", "tshirt", "hose", "weste", "fleece", "muetze"]
SIZES = [("XS", 5), ("S", 20), ("M", 30), ("L", 25), ("XL", 15), ("XXL", 5)]
CONDITIONS = [("Neu mit Etikett", 10), ("Neu ohne Etikett", 10), ("Sehr gut", 45), ("Gut", 30),
              ("Zufriedenstellend", 5)]

# Echte Finds: (Marke, Titel, Größe, Preis, Zustand, Minuten online) – sollten gemeldet werden
FINDS = [
    ("Carhartt", "Vintage Carhartt Detroit Jacket Made in USA", "M", 45, "Gut", 2),
    ("Arc'teryx", "Arc'teryx Beta LT Jacke Gore-Tex", "M", 79, "Sehr gut", 3),
    ("Stone Island", "Stone Island Strickpullover", "L", 45, "Sehr gut", 1),
    ("Stüssy", "Stüssy 8 Ball Hoodie", "S", 25, "Gut", 4),
    ("Patagonia", "Patagonia Retro X Fleece", "M", 30, "Sehr gut", 6),
    ("Ralph Lauren", "Vintage Polo Sport Jacke 90s", "L", 22, "Gut", 2),
    ("Miu Miu", "Miu Miu Tasche Leder", "", 160, "Sehr gut", 2),
    ("", "Vintage Lederjacke 90er", "L", 10, "Gut", 3),  # No-Name, gefunden über die Trend-Suche
    ("Abercrombie & Fitch", "Abercrombie & Fitch Y2K Jacke mit Fellkragen", "S", 15, "Sehr gut", 2),
    ("Vintage", "Adidas Trainingsjacke vintage 90er", "L", 12, "Gut", 2),      # Marke "Vintage" gewählt
    ("", "Vintage 90er Windbreaker", "M", 4, "Gut", 3),
    ("Carhartt WIP", "Carhartt WIP Jacke neu mit Etikett", "M", 22, "Neu mit Etikett", 2),
    ("Stone Island", "Stone Island Hoodie mit Badge", "L", 35, "Sehr gut", 3),
]
# Fallen: (Marke, Titel, Größe, Preis, Zustand, Minuten online, warum nicht) – sollten NICHT gemeldet werden
TRAPS = [
    ("Nike", "Nike Air Max 90", "43", 15, "Sehr gut", 1, "Schuhe"),
    ("Stone Island", "Stone Island Jacke inspired", "M", 40, "Neu mit Etikett", 2, "Fake"),
    ("Carhartt", "Carhartt Jacke", "XL", 30, "Sehr gut", 2, "falsche Größe"),
    ("Arc'teryx", "Arc'teryx Jacke", "M", 190, "Sehr gut", 1, "normaler Preis"),
    ("Carhartt", "Carhartt WIP Hoodie", "M", 38, "Sehr gut", 3, "normaler Preis"),
    ("No Name", "Jacke im Stone Island Style", "M", 30, "Gut", 2, "keine echte Marke"),
    ("The North Face", "The North Face Kinder Jacke", "164", 25, "Gut", 2, "Kindergröße"),
    ("Ralph Lauren", "Ralph Lauren Pullover defekt", "M", 10, "Zufriedenstellend", 1, "defekt"),
    ("Carhartt", "Carhartt Detroit Jacket", "M", 39, "Gut", 45, "zu lange online"),
    ("Patagonia", "Patagonia Fleece", "M", 55, "Sehr gut", 3, "kaum Rabatt"),
    ("Miu Miu", "Miu Miu Tasche", "", 35, "Neu mit Etikett", 1, "Fake-Verdacht"),
    ("H&M", "H&M Lederjacke", "M", 8, "Sehr gut", 2, "lohnt sich nicht (Fast Fashion)"),
    ("Carhartt", "Carhartt WIP Logo Patch für Jacken", "", 3, "Neu mit Etikett", 1, "nur ein Patch"),
    ("Stone Island", "Stone Island Archivio Buch", "", 15, "Sehr gut", 2, "Buch"),
    ("Abercrombie & Fitch", "Abercrombie & Fitch Sticker", "", 2, "Neu ohne Etikett", 1, "Sticker"),
    ("No Name", "Jacke wie Carhartt", "M", 10, "Gut", 1, "keine echte Carhartt"),
    ("Carhartt WIP", "Suche Carhartt Jacke", "M", 20, "Sehr gut", 1, "Suchanzeige"),
]


def _pick(rng: random.Random, weighted: list[tuple[str, int]]) -> str:
    return rng.choices([v for v, _ in weighted], weights=[w for _, w in weighted])[0]


def _raw(item_id: int, brand: str, title: str, size: str, price: float, condition: str, minutes: float,
         now: float, favs: int = 0) -> dict[str, Any]:
    return {
        "id": item_id, "title": title, "brand_title": brand, "size_title": size, "status": condition,
        "price": {"amount": f"{price:.2f}", "currency_code": "EUR"},
        "total_item_price": {"amount": f"{price + 0.7 + price * 0.05:.2f}", "currency_code": "EUR"},
        "url": f"{BASE}/items/{item_id}-muster", "favourite_count": favs,
        "user": {"id": 10_000 + item_id, "login": f"muster{item_id}"},
        "photo": {"url": None, "high_resolution": {"timestamp": int(now - minutes * 60)}},
    }


def typical_price(brand: str, ptype: str) -> float:
    """Typischer Preis laut Preisschätzung (so "denkt" der Markt im Musterdatensatz)."""
    title = f"{brand} {TITLES[ptype][0]}".strip()
    return estimate(title, brand, "Sehr gut", "M", product_type(title), explicit=prior_price(brand, ptype)).value


def market_listings(rng: random.Random, brand: str, now: float, start_id: int,
                    types: Optional[list[str]] = None, brands: Optional[list[str]] = None) -> list[dict]:
    """Normale Angebote rund um den typischen Preis (einer Marke oder gemischt)."""
    out = []
    i = start_id
    for ptype in types or BRAND_TYPES.get(brand, DEFAULT_TYPES):
        for _ in range(rng.randint(7, 11)):
            b = rng.choice(brands) if brands else brand
            price = max(3.0, round(typical_price(b, ptype) * rng.lognormvariate(0, 0.3)))
            size = str(rng.randint(39, 46)) if ptype == "schuhe" else ("" if ptype == "tasche" else _pick(rng, SIZES))
            out.append(_raw(i, b, f"{b} {rng.choice(TITLES[ptype])}".strip(), size, price,
                            _pick(rng, CONDITIONS), rng.uniform(30, 900), now, rng.randint(0, 6)))
            i += 1
    return out


def fresh_listings(rng: random.Random, brand: str, now: float, start_id: int) -> list[dict]:
    """Frisch hochgeladene Alltags-Angebote (meist normaler Preis)."""
    out = []
    for k in range(3):
        ptype = rng.choice([t for t in BRAND_TYPES.get(brand, DEFAULT_TYPES) if t != "schuhe"])
        price = max(3.0, round(typical_price(brand, ptype) * rng.lognormvariate(0, 0.25)))
        out.append(_raw(start_id + k, brand, f"{brand} {rng.choice(TITLES[ptype])}", _pick(rng, SIZES), price,
                        _pick(rng, CONDITIONS), rng.uniform(1, 9), now))
    return out


class SampleClient:
    """Tut so, als wäre es Vinted: 1. Abfrage = Markt, 2. Abfrage = Markt + frische Artikel."""

    def __init__(self, seed: int, now: float):
        rng = random.Random(seed)
        self.calls: dict[str, int] = {}
        self.market: dict[str, list[Item]] = {}
        self.fresh: dict[str, list[Item]] = {}
        self.finds: set[int] = set()
        self.traps: dict[int, str] = {}
        next_id = 1000
        for brand in SAMPLE_BRANDS:
            raws = market_listings(rng, brand, now, next_id)
            next_id += 200
            self.market[brand] = [parse_item(r, BASE) for r in raws]
            self.fresh[brand] = [parse_item(r, BASE) for r in fresh_listings(rng, brand, now, next_id)]
            next_id += 50
        for term, (ptype, brands) in SAMPLE_TERMS.items():
            raws = market_listings(rng, term, now, next_id, types=[ptype], brands=brands)
            next_id += 200
            self.market[term] = [parse_item(r, BASE) for r in raws]
            self.fresh[term] = []
        for k, (brand, title, size, price, cond, minutes) in enumerate(FINDS):
            item = parse_item(_raw(1 + k, brand, title, size, price, cond, minutes, now, favs=3), BASE)
            self.fresh[self._target(brand, title)].insert(0, item)
            self.finds.add(item.id)
        for k, (brand, title, size, price, cond, minutes, why) in enumerate(TRAPS):
            item = parse_item(_raw(100 + k, brand, title, size, price, cond, minutes, now), BASE)
            self.fresh[self._target(brand, title)].insert(0, item)
            self.traps[item.id] = why

    @staticmethod
    def _target(brand: str, title: str) -> str:
        """In welcher Suche taucht der Artikel auf? (Marke im Titel, sonst passende Trend-Suche)"""
        for term in SAMPLE_TERMS:  # 1) Suchbegriff steht komplett im Titel
            if all(w in title.lower() for w in term.lower().split()):
                return term
        for b in SAMPLE_BRANDS:     # 2) Marke steht im Titel
            if b.lower() in title.lower():
                return b
        for term in SAMPLE_TERMS:  # 3) passende Kategorie einer Trend-Suche
            if SAMPLE_TERMS[term][0] in product_type(title) and brand not in SAMPLE_BRANDS:
                return term
        return brand

    def search(self, query: Any, per_page: int = 48) -> list[Item]:
        brand = query.search_text
        n = self.calls.get(brand, 0)
        self.calls[brand] = n + 1
        market = self.market.get(brand, [])
        return list(market) if n == 0 else self.fresh.get(brand, []) + list(market)


class _Collector:
    def __init__(self) -> None:
        self.alerts: list[Alert] = []

    def __bool__(self) -> bool:
        return True

    def send_alert(self, alert: Alert) -> bool:
        self.alerts.append(alert)
        return True

    def send_text(self, text: str) -> None:
        pass


COPY_STATE = ("filter_sizes", "filter_exclude_types", "only_rare", "resale_level", "prefs", "own_prices")


@dataclass
class SampleResult:
    alerts: list[Alert]
    rejected: list[tuple[Item, str]]
    finds: set[int]
    traps: dict[int, str]
    checked: int
    settings: str = ""
    found_finds: set[int] = field(default_factory=set)

    @property
    def wrong_alerts(self) -> list[Alert]:
        return [a for a in self.alerts if a.item.id in self.traps]

    def summary_lines(self) -> list[str]:
        fresh = len(self.alerts) + len(self.rejected)
        lines = [f"Geprüft: {self.checked} Angebote aus {len(SAMPLE_BRANDS)} Marken + {len(SAMPLE_TERMS)} Trend-Suche, "
                 f"davon {fresh} frisch hochgeladen",
                 f"Echte Finds im Datensatz erkannt: {len(self.found_finds)} von {len(self.finds)} · "
                 f"Fallen fälschlich gemeldet: {len(self.wrong_alerts)} von {len(self.traps)}",
                 f"Einstellungen: {self.settings}", "", f"✅ Gemeldet ({len(self.alerts)}):"]
        for a in self.alerts:
            gem = " 💎" if a.score.rarity_level else ""
            disc = f" (−{a.score.discount:.0%})" if a.score.discount else ""
            lines.append(f"• {a.item.title} – {money(a.item.price)}{disc}{gem}")
        lines.append("")
        lines.append("❌ Aussortiert (Auswahl):")
        shown = [(i, why) for i, why in self.rejected if i.id in self.traps] + \
                [(i, why) for i, why in self.rejected if i.id not in self.traps]
        for item, why in shown[:12]:
            lines.append(f"• {item.title} – {why}")
        return lines

    def summary_html(self) -> str:
        return "<b>🧪 Probelauf mit Musterdaten</b>\n" + "\n".join(html.escape(x) for x in self.summary_lines())

    def summary_text(self) -> str:
        return "🧪 Probelauf mit Musterdaten\n" + "\n".join(self.summary_lines())


def run_sample(cfg: Config, source_storage: Optional[Storage] = None, seed: int = 7,
               now: Optional[float] = None) -> SampleResult:
    """Lässt den echten Bewertungs-Code über die Musterdaten laufen – mit deinen aktuellen Einstellungen."""
    from .monitor import Monitor

    now = now or time.time()
    storage = Storage(":memory:")
    if source_storage is not None:
        for key in COPY_STATE:
            value = source_storage.get_state(key)
            if value is not None:
                storage.set_state(key, value)
    searches = [SearchConfig.watch(b, source="telegram") for b in list(SAMPLE_BRANDS) + list(SAMPLE_TERMS)]
    sample_cfg = replace(cfg, searches=searches)
    client = SampleClient(seed, now)
    collector = _Collector()
    monitor = Monitor(sample_cfg, client, storage, collector, clock=lambda: now)
    monitor.pause_between_searches = (0, 0)
    monitor.reject_log = []
    mon_log = logging.getLogger("vinted_bot.monitor")
    old_level = mon_log.level
    mon_log.setLevel(logging.WARNING)  # Probelauf soll das Protokoll nicht vollschreiben
    monitor.run_once()   # Markt lernen
    monitor.reject_log = []
    checked_before = monitor.stats["checked"]
    monitor.run_once()   # frische Artikel bewerten

    mon_log.setLevel(old_level)
    f = monitor.global_filters()
    t = monitor.resale_targets()
    settings = (f"Stufe {monitor.resale_level or 'aus config'} · Größen {', '.join(f['sizes']) or 'alle'} · "
                f"ausgeblendet: {', '.join(f['exclude_types']) or 'nichts'} · "
                f"≥ {t['min_discount']:g} % unter Wert · ≤ {t['max_age_minutes']} Min."
                + (" · nur Raritäten" if f["only_rare"] else ""))
    alerts = sorted(collector.alerts, key=lambda a: a.score.total, reverse=True)
    result = SampleResult(alerts=alerts, rejected=[(i, why) for _s, i, why in monitor.reject_log],
                          finds=client.finds, traps=client.traps, checked=monitor.stats["checked"] - checked_before,
                          settings=settings)
    result.found_finds = {a.item.id for a in alerts} & client.finds
    storage.close()
    return result
