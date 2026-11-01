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

from .catalog import NO_BRAND, Estimate, brand_info, detect_brand, estimate, product_type
from .catalog import resolve_type as _resolve_type
from .models import Item
from .text import normalize

resolve_type = _resolve_type  # für ältere Importe

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
              "silver tab", "made in usa", "made in u.s.a"],
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
    return normalize(text)


def brand_key(brand: str) -> str:
    """'Carhartt WIP' -> 'carhartt', 'Polo Ralph Lauren' -> 'ralphlauren' (Schlüssel für Wissen & Vorlieben)."""
    b = _norm(brand)
    if not b or b in NO_BRAND:
        return ""
    for key in sorted(set(BRAND_GRAILS) | set(_priors()), key=len, reverse=True):
        if key in b or (len(b) >= 4 and b in key):
            return key
    info = brand_info(brand)
    return _norm(info[0]) if info else b


def item_brand(item: Item) -> str:
    """Marke des Artikels – oder aus dem Titel erkannt, wenn keine angegeben ist."""
    if _norm(item.brand) not in NO_BRAND:
        return item.brand
    return detect_brand(item.title) or ""


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
    for grail in BRAND_GRAILS.get(brand_key(item_brand(item)), []):
        if re.search(rf"(?<![a-z0-9]){re.escape(grail)}(?![a-z0-9])", title):
            label = grail.title() if len(grail) > 3 else grail.upper()
            if _norm(label) not in {_norm(t) for t in tags}:  # "Made in USA" nicht doppelt anzeigen
                tags.append(label)
            points += 2
            break
    level = 0 if points < 2 else 1 if points < 4 else 2 if points < 6 else 3
    return Rarity(level, tags if level else [])


# -- Trends: Modelle & Styles, die sich auf Vinted gerade gut verkaufen ----------------------

TREND_MODELS: list[tuple[str, str]] = [
    (r"\bdetroit\b", "Carhartt Detroit"), (r"double knee", "Double Knee"), (r"active jacket", "Active Jacket"),
    (r"tech fleece", "Tech Fleece"), (r"\bacg\b", "Nike ACG"), (r"\bnocta\b", "Nocta"),
    (r"track ?jacket|trainingsjacke|track ?top", "Trainingsjacke"), (r"\bnuptse\b", "Nuptse"),
    (r"retro[ -]?x\b", "Retro X"), (r"synchilla", "Synchilla"), (r"polo bear", "Polo Bear"),
    (r"polo sport", "Polo Sport"), (r"zopf|cable knit", "Zopfstrick"), (r"wachsjacke|wax jacket", "Wachsjacke"),
    (r"harrington", "Harrington"), (r"le pliage", "Le Pliage"), (r"re-?nylon", "Re-Nylon"),
    (r"saddle bag", "Saddle Bag"), (r"\bbaguette\b", "Baguette"), (r"k[aå]nken", "Kånken"),
    (r"(?:vintage|retro).{0,20}trikot|trikot.{0,20}(?:vintage|retro|19[89]\d|200\d)", "Retro-Trikot"),
    (r"college ?jacke|varsity", "College-Jacke"), (r"band ?shirt|tour ?shirt", "Band-Shirt"),
    (r"harley[ -]davidson", "Harley Davidson"), (r"\by2k\b", "Y2K"), (r"\bjorts\b", "Jorts"),
    (r"\bbaggy\b", "Baggy"), (r"workwear", "Workwear"), (r"8[ -]?ball", "8 Ball"), (r"world tour", "World Tour"),
    (r"shadow project", "Shadow Project"), (r"\bghost\b", "Ghost Piece"), (r"\bgoggle\b", "Goggle"),
    (r"veilance", "Veilance"), (r"beta (?:lt|ar|sv)", "Beta"), (r"\batom (?:lt|ar|sl|hoody)", "Atom"),
    (r"\bbig e\b", "Big E"), (r"orange tab", "Orange Tab"), (r"ed hardy", "Ed Hardy"),
    (r"von dutch", "Von Dutch"), (r"juicy couture", "Juicy Couture"), (r"leopard|animal print", "Leo-Print"),
    (r"gorpcore", "Gorpcore"), (r"barrel", "Barrel Jeans"), (r"\bsamba\b", "Samba"), (r"tasman", "Tasman"),
    (r"boot ?cut|\bflared?\b|schlag(?:hose|jeans)", "Bootcut/Flared"), (r"low ?rise", "Low Rise"),
]
TREND_PREMIUM = 1.1
TREND_POINTS = 5


def trend_match(title: str) -> Optional[str]:
    t = (title or "").lower()
    for pattern, label in TREND_MODELS:
        if re.search(pattern, t):
            return label
    return None


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


# Feinere Kategorien auf die Spalten in market_prices.json abbilden (mit kleinem Auf-/Abschlag)
_EXPLICIT_PARENT = {"mantel": ("jacke", 1.2), "daunenjacke": ("jacke", 1.3), "lederjacke": ("jacke", 1.3),
                    "blazer": ("jacke", 0.8), "jeans": ("hose", 1.0), "jogginghose": ("hose", 0.8),
                    "sneaker": ("schuhe", 1.0), "stiefel": ("schuhe", 1.1), "sandalen": ("schuhe", 0.6),
                    "rucksack": ("tasche", 1.0), "geldboerse": ("tasche", 0.6), "top": ("tshirt", 0.9),
                    "trikot": ("tshirt", 1.3)}


def prior_price(brand: str, ptype: str) -> Optional[float]:
    """Genauer Startwert aus market_prices.json für Marke + Kategorie (oder None)."""
    b = _norm(brand)
    if not b:
        return None
    key = next((k for k in sorted(_priors(), key=len, reverse=True) if k in b or (len(b) >= 4 and b in k)), None)
    table = _priors().get(key or "")
    if not table:
        return None
    if table.get(ptype):
        return float(table[ptype])
    parent, factor = _EXPLICIT_PARENT.get(ptype, (None, 1.0))
    if parent and table.get(parent):
        return float(table[parent]) * factor
    return None


def estimate_item(item: Item, ptype: Optional[str] = None) -> Estimate:
    """Preisschätzung für einen Vinted-Artikel (Marke, Kategorie, Zustand, Kindergröße)."""
    brand = item_brand(item)
    ptype = ptype or product_type(item.title)
    return estimate(item.title, brand, item.condition, item.size, ptype, explicit=prior_price(brand, ptype))


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


# Bundweite -> Buchstabengröße (Damen und Herren überlappen, deshalb lieber großzügig zwei Größen)
_W_SIZES = [(25, ("XXS", "XS")), (27, ("XS", "S")), (29, ("S", "M")), (31, ("M",)), (32, ("M", "L")),
            (34, ("L",)), (36, ("L", "XL")), (38, ("XL", "XXL")), (99, ("XXL", "XXXL"))]
# EU-Konfektionsgrößen: Damen 32–44, Herren 46–56
_EU_SIZES = {32: "XXS", 34: "XS", 36: "S", 38: "M", 40: "L", 42: "XL", 44: "XXL",
             46: "S", 48: "M", 50: "L", 52: "XL", 54: "XXL", 56: "XXXL"}


def letter_equivalents(size: str) -> set[str]:
    """'W30 L32' -> {'M'}, '38' -> {'M'}, '30/32' -> {'M'} – damit Jeans & Co. nicht am Größenfilter scheitern."""
    s = (size or "").upper()
    out: set[str] = set()
    widths = [int(w) for w in re.findall(r"W\s?(\d{2})", s)]
    m = re.match(r"^\s*(\d{2})\s*[/X]\s*(\d{2})\s*$", s)  # "30/32" = Weite/Länge
    if m and 23 <= int(m.group(1)) <= 44:
        widths.append(int(m.group(1)))
    for w in widths:
        out.update(next(letters for limit, letters in _W_SIZES if w <= limit))
    if not widths:
        for num in re.findall(r"(?<![0-9])(\d{2})(?![0-9])", s):
            if int(num) in _EU_SIZES:
                out.add(_EU_SIZES[int(num)])
    return out


def size_matches(item_size: str, wanted: Iterable[str]) -> bool:
    """Passt die Größe? Artikel ohne Größe (Taschen, Caps, 'One Size') passen immer."""
    wanted_set = set(normalize_sizes(wanted))
    if not wanted_set:
        return True
    if is_one_size(item_size):
        return True
    tokens = size_tokens(item_size)
    if wanted_set & set(LETTER_SIZES):
        tokens |= letter_equivalents(item_size)
    return bool(tokens & wanted_set)
