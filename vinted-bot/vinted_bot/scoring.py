"""Filter und Deal-Bewertung: Wie gut ist ein Angebot (0-100)?"""

from __future__ import annotations

import math
import re
import time
from dataclasses import dataclass, field
from statistics import median
from typing import Iterable, Optional

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


@dataclass
class DealScore:
    total: int
    reference_price: Optional[float]
    discount: Optional[float]  # 0.3 = 30 % unter Referenzpreis
    is_top: bool
    reasons: list[str] = field(default_factory=list)


def _contains_word(text: str, word: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(word.lower())}(?!\w)", text) is not None


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
    if search.brands and not any(_contains_word(haystack, b) for b in search.brands):
        return False, "andere Marke"
    if search.sizes:
        size = item.size.lower().strip()
        wanted = {s.lower().strip() for s in search.sizes}
        # "M / 38 / 10" soll auch bei Wunschgröße "M" passen
        parts = {p.strip() for p in re.split(r"[/|,]", size)} | {size}
        if not parts & wanted:
            return False, "andere Größe"
    return True, ""


def reference_price(market_price: Optional[float], history: list[float], min_samples: int = 8) -> Optional[float]:
    """Marktpreis aus der Config, sonst Median der bisher gesehenen Preise dieser Suche."""
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


def score_item(item: Item, ref_price: Optional[float], top_threshold: int = 75,
               now: Optional[float] = None) -> DealScore:
    now = now if now is not None else time.time()
    reasons: list[str] = []

    # 1) Preis im Vergleich zum Markt (max. 60 Punkte)
    discount = None
    if ref_price and ref_price > 0:
        discount = 1 - item.price / ref_price
        price_pts = max(0.0, min(60.0, 20 + discount * 80))
        if discount >= 0.05:
            reasons.append(f"{discount:.0%} unter Marktpreis (Ø {ref_price:.0f} {_sym(item.currency)})")
        elif discount <= -0.1:
            reasons.append(f"{-discount:.0%} über Marktpreis (Ø {ref_price:.0f} {_sym(item.currency)})")
        else:
            reasons.append(f"fairer Preis (Ø {ref_price:.0f} {_sym(item.currency)})")
    else:
        price_pts = 25.0
        reasons.append("noch zu wenig Preisdaten für einen Vergleich")

    # 2) Zustand (max. 20)
    cond_pts = condition_points(item.condition)

    # 3) Frische: wer zuerst kommt, kauft zuerst (max. 10)
    age_min = (now - item.created_ts) / 60 if item.created_ts else None
    if age_min is None:
        fresh_pts = 5
    elif age_min <= 5:
        fresh_pts = 10
    elif age_min <= 15:
        fresh_pts = 7
    elif age_min <= 60:
        fresh_pts = 4
    else:
        fresh_pts = 0

    # 4) Beliebtheit: viele Favoriten kurz nach dem Einstellen = begehrt (max. 10)
    if age_min is not None and age_min <= 120:
        pop_pts = min(10, item.favourites * 2)
    else:
        pop_pts = min(5, item.favourites)
    if pop_pts >= 6:
        reasons.append(f"schon {item.favourites} Favoriten – schnell sein!")

    total = int(round(price_pts + cond_pts + fresh_pts + pop_pts))
    total = max(0, min(100, total))
    return DealScore(total=total, reference_price=ref_price, discount=discount,
                     is_top=total >= top_threshold, reasons=reasons)


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
