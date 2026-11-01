"""Vorwissen des Bots: Raritäten, Marktpreis-Startwerte, Produkttyp-Namen und Größen.

Die Startwerte für Marktpreise sind grobe Schätzungen typischer Vinted-Wiederverkaufspreise
(gebraucht, guter Zustand). Sie helfen nur am Anfang – sobald der Bot genug echte Preise
gesehen hat, zählen die echten Daten (siehe scoring.market_reference).
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Iterable, Optional

from .models import Item

# -- Raritäten --------------------------------------------------------------------------

# (Muster, Anzeige, Punkte). Muster sind reguläre Ausdrücke auf dem kleingeschriebenen Titel.
RARE_SIGNALS: list[tuple[str, str, int]] = [
    (r"\bvintage\b", "vintage", 1),
    (r"\b(?:19)?90'?s\b|\b90er\b|\bnineties\b", "90er", 1),
    (r"\b(?:19)?80'?s\b|\b80er\b", "80er", 1),
    (r"\by2k\b|\b00'?s\b|\b2000er\b", "Y2K", 1),
    (r"\bmade in (?:the )?(?:usa|u\.s\.a\.?|us|italy|italia|england|uk|great britain|canada|japan|"
     r"west germany|france|portugal)\b", "Made in …", 2),
    (r"(?<!made in )\bwest germany\b", "West Germany", 2),
    (r"\bdeadstock\b|\bnew old stock\b", "Deadstock", 2),
    (r"\bsingle stitch\b", "Single Stitch", 2),
    (r"\bsample\b|\bprototyp(?:e)?\b|\bmusterteil\b", "Sample", 2),
    (r"\barchiv(?:e)?\b", "Archive", 1),
    (r"\brar(?:e)?\b|\bselten(?:e|es|er)?\b|\brarität\b|\braritaet\b", "selten", 1),
    (r"\blimit(?:ed|iert|ierte|iertes)\b", "limitiert", 1),
    (r"\bcollab(?:oration)?\b", "Collab", 1),
    (r"\bsammler(?:stück|stueck)?\b", "Sammlerstück", 1),
    (r"\bgrail\b", "Grail", 2),
]

# Begehrte Modelle je Marke (Schlüssel = normalisierter Markenname)
BRAND_GRAILS: dict[str, list[str]] = {
    "carhartt": ["detroit", "santa fe", "active jacket", "chore coat", "arctic coat", "double knee",
                 "traditional coat", "blanket lined", "j97", "j01"],
    "stussy": ["8 ball", "8-ball", "eight ball", "world tour", "shadow man", "shadowman", "tribe", "old stussy"],
    "arcteryx": ["veilance", "leaf", "alpha sv", "beta sv", "theta ar", "sidewinder", "made in canada"],
    "salomon": ["s/lab", "s-lab", "slab"],
    "thenorthface": ["steep tech", "nuptse 1996", "1996 nuptse", "summit series", "mountain light",
                     "mountain guide", "himalayan", "purple label", "extreme"],
    "patagonia": ["retro x", "retro-x", "deep pile", "snap-t", "snap t", "glissade", "pataloha"],
    "ralphlauren": ["rrl", "polo sport", "stadium", "p-wing", "polo bear", "hi tech", "snow beach",
                    "cookie", "purple label", "1992", "1993"],
    "lacoste": ["chemise", "izod"],
    "stoneisland": ["shadow project", "ghost", "marina", "reflective", "ice jacket", "membrana",
                    "raso gommato", "formula steel"],
    "cpcompany": ["goggle", "mille miglia", "watchviewer", "explorer", "urban protection", "50 fili"],
    "levis": ["big e", "501xx", "orange tab", "type 1", "type 2", "type 3", "lvc", "selvedge", "silvertab",
              "silver tab"],
    "barbour": ["2 crest", "two crest", "3 crest", "three crest", "border", "gamefair", "a7"],
    "nike": ["acg", "center swoosh", "centre swoosh", "middle swoosh", "nocta", "sacai", "off-white",
             "off white"],
    "adidas": ["equipment", "eqt", "y-3", "wales bonner"],
    "dickies": ["made in usa"],
}

RARE_PREMIUM = {0: 1.0, 1: 1.2, 2: 1.4, 3: 1.6}  # Raritäten sind mehr wert als ein Durchschnittsteil


@dataclass
class Rarity:
    level: int = 0                         # 0 = normal, 1 = interessant, 2 = selten, 3 = sehr selten
    tags: list[str] = field(default_factory=list)

    @property
    def premium(self) -> float:
        return RARE_PREMIUM.get(self.level, 1.0)


def _norm(text: str) -> str:
    from .scoring import normalize  # spät importieren (Kreisimport vermeiden)
    return normalize(text)


def brand_key(brand: str) -> str:
    """'Carhartt WIP' -> 'carhartt', 'Ralph Lauren' -> 'ralphlauren' (Schlüssel für Wissen & Vorlieben)."""
    b = _norm(brand)
    if not b:
        return ""
    for key in sorted(set(BRAND_GRAILS) | set(_priors()), key=len, reverse=True):
        if key in b or (len(b) >= 4 and b in key):
            return key
    return b


def rarity(item: Item) -> Rarity:
    title = f" {item.title.lower()} "
    tags: list[str] = []
    points = 0
    for pattern, label, pts in RARE_SIGNALS:
        m = re.search(pattern, title)
        if m and label not in tags:
            if label == "Made in …":  # "made in usa" -> "Made in USA"
                country = m.group(0).split(" ", 2)[-1]
                label = "Made in " + (country.upper() if len(country.replace(".", "")) <= 3 else country.title())
            tags.append(label)
            points += pts
    for grail in BRAND_GRAILS.get(brand_key(item.brand), []):
        if re.search(rf"(?<![a-z0-9]){re.escape(grail)}(?![a-z0-9])", title):
            tags.append(grail.title() if len(grail) > 3 else grail.upper())
            points += 2
            break
    level = 0 if points < 2 else 1 if points < 4 else 2 if points < 6 else 3
    return Rarity(level, tags if level else [])


# -- Marktpreis-Startwerte --------------------------------------------------------------

@lru_cache(maxsize=1)
def _priors() -> dict[str, dict[str, float]]:
    path = os.path.join(os.path.dirname(__file__), "data", "market_prices.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return {}
    return {k: v for k, v in data.items() if not k.startswith("_") and isinstance(v, dict)}


def prior_price(brand: str, ptype: str) -> Optional[float]:
    """Geschätzter typischer Wiederverkaufspreis für Marke + Produkttyp (oder None)."""
    table = _priors().get(brand_key(brand))
    if not table:
        return None
    value = table.get(ptype)
    return float(value) if value else None


# -- Produkttypen: Namen, die man in Telegram tippen kann --------------------------------

TYPE_ALIASES: dict[str, list[str]] = {
    "schuhe": ["schuhe", "schuh", "sneaker", "sneakers", "shoes", "turnschuhe", "boots", "stiefel"],
    "jacke": ["jacken", "jacke", "jackets", "jacket", "mantel", "mäntel", "parka"],
    "hoodie": ["hoodies", "hoodie", "kapuzenpullover"],
    "pullover": ["pullover", "pulli", "pullis", "sweater", "sweatshirts", "strick"],
    "tshirt": ["shirts", "shirt", "t-shirts", "tshirts", "t-shirt", "tshirt", "polos", "polo", "tops"],
    "hemd": ["hemden", "hemd"],
    "hose": ["hosen", "hose", "jeans", "pants"],
    "shorts": ["shorts", "kurze hosen"],
    "weste": ["westen", "weste", "vests"],
    "fleece": ["fleece"],
    "tasche": ["taschen", "tasche", "rucksack", "rucksäcke", "bags"],
    "muetze": ["mützen", "mütze", "muetzen", "muetze", "caps", "cap", "beanies", "hüte", "hut"],
    "kleid": ["kleider", "kleid"],
    "rock": ["röcke", "rock"],
    "schmuck": ["schmuck"],
    "uhr": ["uhren", "uhr"],
    "guertel": ["gürtel", "guertel"],
    "schal": ["schals", "schal"],
    "brille": ["brillen", "brille", "sonnenbrillen"],
    "sonstiges": ["sonstiges", "andere", "rest"],
}


def resolve_type(word: str) -> Optional[str]:
    w = _norm(word)
    for ptype, aliases in TYPE_ALIASES.items():
        if w == _norm(ptype) or any(w == _norm(a) for a in aliases):
            return ptype
    return None


# -- Größen ------------------------------------------------------------------------------

LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]
_SIZE_ALIASES = {"2XL": "XXL", "3XL": "XXXL", "2XS": "XXS"}
ONE_SIZE = ("one size", "onesize", "einheitsgröße", "einheitsgroesse", "universal", "taille unique", "os")


def size_tokens(size: str) -> set[str]:
    """'M / 38 / 10' -> {'M', '38', '10'}; 'W32 | L32' -> {'W32', 'L32'}."""
    parts = re.split(r"[/|,;]+|\s+", (size or "").upper())
    return {_SIZE_ALIASES.get(p, p) for p in (x.strip() for x in parts) if p}


def is_one_size(size: str) -> bool:
    s = (size or "").strip().lower()
    return not s or s in ONE_SIZE or "one size" in s or "einheitsgr" in s


def normalize_sizes(values: Iterable[str]) -> list[str]:
    out: list[str] = []
    for v in values:
        for tok in size_tokens(str(v)):
            if tok and tok not in out:
                out.append(tok)
    return out


def size_matches(item_size: str, wanted: Iterable[str]) -> bool:
    """Passt die Größe? Artikel ohne Größe (Taschen, Caps, 'One Size') passen immer."""
    wanted_set = set(normalize_sizes(wanted))
    if not wanted_set:
        return True
    if is_one_size(item_size):
        return True
    return bool(size_tokens(item_size) & wanted_set)
