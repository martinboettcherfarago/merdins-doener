"""Produktkatalog & Preisschätzung für (fast) alles, was es auf Vinted gibt.

Jede Kategorie hat einen Grundpreis: der typische Wiederverkaufspreis eines gebrauchten Artikels
einer normalen Marke (z. B. Nike, Levi's, Esprit) in "sehr gutem" Zustand. Daraus wird geschätzt:

    Schätzung = Grundpreis × Faktor der Preisklasse der Marke × Zustand × (Kinder) × (Rarität/Trend)

Für die wichtigsten Trend-Marken gibt es genauere Werte (data/market_prices.json), und der Bot
mischt alles mit den echten Preisen, die er auf Vinted sieht – je mehr Daten, desto genauer.
Alle Zahlen sind Erfahrungswerte/Schätzungen und können in den Dateien angepasst werden.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

from .text import keyword_in, normalize


@dataclass(frozen=True)
class Category:
    key: str
    label: str        # Mehrzahl für Meldungen ("Jacken")
    base: float       # Grundpreis in € (normale Marke, gebraucht, sehr gut)
    group: str        # clothing / outerwear / shoes / bags / accessories / other
    family: str       # Oberkategorie für Filter: /ohne schuhe blendet sneaker, stiefel … aus
    volatile: bool = False  # Preise schwanken stark (Elektronik, Sammelkarten …) -> Schätzung unsicher


CATEGORIES: dict[str, Category] = {c.key: c for c in [
    # Kleidung
    Category("tshirt", "Shirts", 9, "clothing", "oberteil"),
    Category("top", "Tops & Blusen", 10, "clothing", "oberteil"),
    Category("hemd", "Hemden", 14, "clothing", "oberteil"),
    Category("trikot", "Trikots", 25, "clothing", "oberteil"),
    Category("pullover", "Pullover", 18, "clothing", "pullover"),
    Category("hoodie", "Hoodies", 20, "clothing", "pullover"),
    Category("fleece", "Fleece", 22, "clothing", "pullover"),
    Category("kleid", "Kleider", 18, "clothing", "kleid"),
    Category("rock", "Röcke", 12, "clothing", "rock"),
    Category("blazer", "Blazer & Sakkos", 25, "clothing", "jacke"),
    Category("hose", "Hosen", 16, "clothing", "hose"),
    Category("jeans", "Jeans", 20, "clothing", "hose"),
    Category("jogginghose", "Jogginghosen", 14, "clothing", "hose"),
    Category("shorts", "Shorts", 12, "clothing", "hose"),
    Category("bademode", "Bademode", 10, "clothing", "bademode"),
    # Jacken & Mäntel
    Category("jacke", "Jacken", 28, "outerwear", "jacke"),
    Category("mantel", "Mäntel", 40, "outerwear", "jacke"),
    Category("daunenjacke", "Daunenjacken", 45, "outerwear", "jacke"),
    Category("lederjacke", "Lederjacken", 45, "outerwear", "jacke"),
    Category("weste", "Westen", 22, "outerwear", "jacke"),
    # Schuhe
    Category("sneaker", "Sneaker", 35, "shoes", "schuhe"),
    Category("stiefel", "Stiefel", 35, "shoes", "schuhe"),
    Category("sandalen", "Sandalen", 16, "shoes", "schuhe"),
    Category("schuhe", "Schuhe", 22, "shoes", "schuhe"),
    # Taschen
    Category("tasche", "Taschen", 22, "bags", "tasche"),
    Category("rucksack", "Rucksäcke", 22, "bags", "tasche"),
    Category("geldboerse", "Geldbörsen", 14, "bags", "tasche"),
    # Accessoires
    Category("muetze", "Mützen & Caps", 9, "accessories", "accessoires"),
    Category("schal", "Schals", 10, "accessories", "accessoires"),
    Category("guertel", "Gürtel", 10, "accessories", "accessoires"),
    Category("brille", "Brillen", 15, "accessories", "accessoires"),
    Category("uhr", "Uhren", 30, "accessories", "accessoires", volatile=True),
    Category("schmuck", "Schmuck", 10, "accessories", "accessoires", volatile=True),
    # Alles andere, was es auf Vinted gibt
    Category("zubehoer", "Handyhüllen & Zubehör", 6, "other", "elektronik"),
    Category("konsole", "Konsolen", 80, "other", "elektronik", volatile=True),
    Category("videospiel", "Videospiele", 15, "other", "elektronik"),
    Category("handy", "Smartphones", 150, "other", "elektronik", volatile=True),
    Category("kopfhoerer", "Kopfhörer", 45, "other", "elektronik", volatile=True),
    Category("kamera", "Kameras", 45, "other", "elektronik", volatile=True),
    Category("elektronik", "Elektronik", 50, "other", "elektronik", volatile=True),
    Category("lego", "Lego", 30, "other", "spielzeug", volatile=True),
    Category("sammelkarten", "Sammelkarten", 10, "other", "spielzeug", volatile=True),
    Category("spielzeug", "Spielzeug", 10, "other", "spielzeug"),
    Category("buch", "Bücher", 6, "other", "medien"),
    Category("medien", "Platten, CDs & DVDs", 10, "other", "medien", volatile=True),
    Category("parfum", "Parfum", 30, "other", "beauty"),
    Category("kosmetik", "Kosmetik", 10, "other", "beauty"),
    Category("deko", "Deko & Wohnen", 10, "other", "wohnen"),
    Category("sonstiges", "Artikel", 12, "other", "sonstiges", volatile=True),
]}

FAMILY_LABELS = {
    "oberteil": "Oberteile", "pullover": "Pullover & Hoodies", "kleid": "Kleider", "rock": "Röcke",
    "hose": "Hosen & Jeans", "bademode": "Bademode", "jacke": "Jacken & Mäntel", "schuhe": "Schuhe",
    "tasche": "Taschen", "accessoires": "Accessoires", "elektronik": "Elektronik & Games",
    "spielzeug": "Spielzeug & Sammeln", "medien": "Bücher & Medien", "beauty": "Beauty", "wohnen": "Wohnen",
    "sonstiges": "Sonstiges",
}

# Erkennung am Titel: erster Treffer gewinnt, deshalb Spezielles vor Allgemeinem.
# 'wort' = irgendwo, '=wort' = Wortanfang, '=wort=' = ganzes Wort (siehe text.keyword_in)
DETECTION: list[tuple[str, list[str]]] = [
    # eindeutige Sneaker-Modelle zuerst ("Nike Blazer Mid" ist kein Sakko)
    ("sneaker", ["blazer mid", "blazer low", "air max", "air force", "=dunk low", "=dunk high", "jordan 1",
                 "jordan 4", "yeezy", "=samba", "gazelle", "=campus 00", "=spezial=", "new balance 550", "=9060",
                 "=2002r", "=1906r", "=990v", "gel-1130", "gel-kayano", "gel-nyc", "=xt-6", "speedcross",
                 "mexico 66", "=tn=", "air max plus", "shox", "vomero", "p-6000", "=530=", "=574=", "=327=",
                 "chuck taylor", "old skool", "superstar", "stan smith", "forum low", "handball spezial"]),
    ("konsole", ["game boy", "gameboy"]),
    ("zubehoer", ["handyhülle", "handyhuelle", "hülle", "=case=", "ladekabel", "ladegerät", "panzerglas"]),
    ("shorts", ["shorts", "kurze hose", "bermuda", "=jorts="]),
    ("kleid", ["kleid", "=dress=", "=dresses="]),
    ("rock", ["minirock", "jeansrock", "faltenrock", "lederrock", "midirock", "maxirock", "bleistiftrock",
              "tüllrock", "=skirt"]),
    ("hoodie", ["hoodie", "hoody", "kapuzenpullover", "kapuzenjacke", "zip hoodie"]),
    ("fleece", ["fleece", "teddyjacke", "sherpa"]),
    ("weste", ["weste", "=vest=", "gilet", "bodywarmer"]),
    ("pullover", ["sweatjacke", "strickjacke", "cardigan", "trainingsjacke", "track jacket", "tracktop",
                  "track top"]),
    ("lederjacke", ["lederjacke", "leather jacket", "bikerjacke", "lederblouson", "wildlederjacke"]),
    ("daunenjacke", ["daunenjacke", "daunen", "puffer", "steppjacke", "nuptse", "down jacket", "=down="]),
    ("mantel", ["mantel", "=coat=", "overcoat", "trenchcoat", "=trench", "parka", "peacoat", "dufflecoat"]),
    ("blazer", ["sakko", "=blazer=", "anzugjacke", "=anzug=", "=suit="]),
    ("jacke", ["jacke", "jacket", "anorak", "windbreaker", "blouson", "bomber", "softshell", "hardshell",
               "regenjacke", "college jacke", "varsity", "wachsjacke", "=shell jacket"]),
    ("pullover", ["pullover", "pulli", "sweatshirt", "sweater", "strick", "crewneck", "=knit", "quarter zip",
                  "half zip", "troyer", "rollkragen", "=jumper="]),
    ("hemd", ["hemd", "overshirt", "flanell", "button down", "button-down", "=shirt jacket"]),
    ("trikot", ["trikot", "=jersey=", "football shirt", "soccer jersey"]),
    ("top", ["bluse", "tanktop", "tank top", "crop top", "croptop", "corsage", "korsett", "bustier", "camisole",
             "neckholder", "trägertop", "=body=", "=top=", "=tops="]),
    ("tshirt", ["t-shirt", "tshirt", "t shirt", "=tee=", "=tees=", "=shirt=", "=shirts=", "longsleeve",
                "=polo=", "poloshirt", "langarmshirt"]),
    ("rock", ["=rock="]),
    ("jogginghose", ["jogginghose", "=jogger", "trackpants", "track pants", "sweatpants", "trainingshose"]),
    ("jeans", ["jeans", "=501", "=denim pants", "=baggy="]),
    ("hose", ["hose", "=pants=", "trousers", "cargo", "chino", "leggings", "=874="]),
    ("bademode", ["bikini", "badeanzug", "badehose", "swimsuit", "swim shorts"]),
    ("sneaker", ["sneaker", "turnschuh", "trainers", "=trainer=", "laufschuh", "running shoe"]),
    ("stiefel", ["stiefel", "=boots=", "=boot=", "stiefelette", "chelsea", "dr. martens", "doc martens",
                 "=uggs=", "tasman", "ugg boots", "ultra mini"]),
    ("sandalen", ["sandale", "=slides=", "badelatschen", "pantolette", "birkenstock", "flip flop", "=clogs="]),
    ("schuhe", ["schuh", "=shoes=", "pumps", "loafer", "ballerina", "high heels", "=heels=", "mokassin"]),
    ("rucksack", ["rucksack", "backpack", "kånken", "kanken"]),
    ("geldboerse", ["geldbörse", "geldboerse", "portemonnaie", "=wallet=", "kartenetui", "card holder",
                    "cardholder"]),
    ("tasche", ["tasche", "=bag=", "=bags=", "handbag", "shopper", "clutch", "beutel", "=speedy",
                "neverfull", "le pliage", "baguette", "saddle bag", "tote"]),
    ("muetze", ["=cap=", "=caps=", "cappy", "mütze", "muetze", "beanie", "=hat=", "=hut=", "kappe",
                "bucket hat", "fischerhut", "basecap", "snapback", "=trucker"]),
    ("schal", ["schal", "scarf", "halstuch", "seidentuch"]),
    ("guertel", ["gürtel", "guertel", "=belt="]),
    ("brille", ["sonnenbrille", "brille", "sunglasses"]),
    ("uhr", ["=uhr=", "armbanduhr", "=watch=", "smartwatch", "g-shock"]),
    ("schmuck", ["kette", "=ring=", "=ringe=", "armband", "ohrring", "necklace", "bracelet", "anhänger",
                 "schmuck", "earrings"]),
    # Nicht-Mode
    ("videospiel", ["videospiel", "=spiel=", "=game=", "=games=", "mario kart", "zelda", "fifa", "call of duty",
                    "=gta", "pokemon edition", "pokémon edition"]),
    ("konsole", ["playstation", "=ps5=", "=ps4=", "=ps3=", "=ps2=", "=ps1=", "xbox", "nintendo switch",
                 "switch oled", "switch lite", "nintendo ds", "=3ds", "=2ds", "=wii", "gamecube", "nintendo 64",
                 "=n64=", "=psp=", "ps vita", "konsole", "console", "steam deck"]),
    ("handy", ["iphone", "smartphone", "=handy=", "samsung galaxy", "=pixel ="]),
    ("kopfhoerer", ["airpods", "kopfhörer", "kopfhoerer", "headphones", "earbuds", "=beats", "=bose="]),
    ("kamera", ["kamera", "camera", "polaroid", "instax", "analogkamera", "objektiv", "spiegelreflex"]),
    ("elektronik", ["ipad", "tablet", "laptop", "macbook", "=kindle", "e-reader", "lautsprecher", "speaker",
                    "=jbl", "=ipod", "mp3", "dyson", "airwrap", "glätteisen"]),
    ("lego", ["lego"]),
    ("sammelkarten", ["pokemon karte", "pokémon karte", "pokemon karten", "pokémon karten", "yu-gi-oh", "yugioh",
                      "sammelkarte", "trading card", "=tcg=", "booster", "panini", "=karten="]),
    ("spielzeug", ["spielzeug", "puppe", "barbie", "plüsch", "kuscheltier", "playmobil", "hot wheels", "=figur",
                   "brettspiel", "puzzle", "sylvanian", "polly pocket", "tamagotchi", "furby", "squishmallow",
                   "jellycat"]),
    ("buch", ["=buch=", "bücher", "=roman=", "taschenbuch", "manga", "=comic", "=book="]),
    ("medien", ["vinyl", "schallplatte", "=lp=", "=cd=", "=cds=", "=dvd", "blu-ray"]),
    ("parfum", ["parfum", "parfüm", "eau de", "=edp=", "=edt=", "perfume", "=duft="]),
    ("kosmetik", ["lippenstift", "make-up", "makeup", "foundation", "mascara", "lidschatten", "=palette=",
                  "serum", "nagellack", "kosmetik", "=creme="]),
    ("deko", ["=deko", "=vase=", "kerze", "=lampe", "bettwäsche", "kissen", "teppich", "geschirr", "=tasse",
              "bilderrahmen", "=poster=", "spiegel", "handtuch"]),
]


def product_type(title: str) -> str:
    t = (title or "").lower()
    for ptype, words in DETECTION:
        if any(keyword_in(t, w) for w in words):
            return ptype
    return "sonstiges"


def category(ptype: str) -> Category:
    return CATEGORIES.get(ptype) or CATEGORIES["sonstiges"]


def family_of(ptype: str) -> str:
    return category(ptype).family


TYPE_LABELS = {k: c.label for k, c in CATEGORIES.items()}

# Namen, die man in Telegram tippen kann (/ohne schuhe, /preis carhartt jacken 90 …)
_EXTRA_ALIASES = {
    "schuhe": ["schuhe", "schuh", "shoes"], "sneaker": ["sneakers", "turnschuhe"], "stiefel": ["boots"],
    "jacke": ["jacken", "jackets", "jacket"], "mantel": ["mäntel", "maentel", "coats"],
    "daunenjacke": ["puffer", "pufferjacken"], "hoodie": ["hoodies"], "pullover": ["pullis", "sweater"],
    "tshirt": ["shirts", "t-shirts", "tshirts", "t-shirt", "polos"], "top": ["tops", "blusen", "bluse"],
    "hemd": ["hemden"], "hose": ["hosen", "pants"], "jeans": ["jeans"], "shorts": ["kurze hosen"],
    "weste": ["westen"], "tasche": ["taschen", "bags", "handtaschen"], "rucksack": ["rucksäcke"],
    "muetze": ["mützen", "mütze", "muetzen", "caps", "cap", "beanies", "hüte", "hut"], "kleid": ["kleider"],
    "rock": ["röcke"], "uhr": ["uhren"], "guertel": ["gürtel"], "schal": ["schals"], "brille": ["brillen"],
    "trikot": ["trikots"], "konsole": ["konsolen"], "videospiel": ["spiele", "games", "videospiele"],
    "handy": ["handys", "smartphones"], "buch": ["bücher", "buecher"], "parfum": ["parfüm", "parfums"],
    "deko": ["wohnen", "haushalt"], "sammelkarten": ["karten", "pokemon"], "spielzeug": ["spielsachen"],
}


def resolve_type(word: str) -> Optional[str]:
    """Telegram-Wort -> Kategorie-Schlüssel oder Oberkategorie ('schuhe' = alle Schuhe)."""
    w = normalize(word)
    if not w:
        return None
    if w in {normalize(f) for f in FAMILY_LABELS} and w not in CATEGORIES:
        return w
    for key, cat in CATEGORIES.items():
        names = [key, cat.label] + _EXTRA_ALIASES.get(key, [])
        if any(w == normalize(n) for n in names):
            # "Taschen", "Jacken", "Hosen" meinen die ganze Gruppe (inkl. Rucksäcke, Mäntel, Jeans …)
            return cat.family if key == cat.family else key
    for fam, label in FAMILY_LABELS.items():
        if w == normalize(label):
            return fam
    return None


def type_hidden(ptype: str, hidden: list[str]) -> bool:
    """Ist die Kategorie (oder ihre Oberkategorie) ausgeblendet?"""
    return ptype in hidden or family_of(ptype) in hidden


def hidden_label(ptype: str, hidden: list[str]) -> str:
    fam = family_of(ptype)
    if ptype not in hidden and fam in hidden:
        return FAMILY_LABELS.get(fam, fam)
    return TYPE_LABELS.get(ptype, ptype)


# -- Marken & Preisklassen ------------------------------------------------------------------

TIER_LABELS = {"luxus": "Luxus", "designer": "Designer", "streetwear": "Streetwear", "outdoor": "Outdoor-Premium",
               "premium": "Premium", "standard": "Standard", "budget": "Fast Fashion"}
TIERS: dict[str, dict[str, float]] = {
    #              Kleidung  Jacken  Schuhe  Taschen  Accessoires
    "budget":     {"clothing": 0.5, "outerwear": 0.5, "shoes": 0.5, "bags": 0.45, "accessories": 0.5},
    "standard":   {"clothing": 1.0, "outerwear": 1.0, "shoes": 1.0, "bags": 1.0, "accessories": 1.0},
    "premium":    {"clothing": 1.8, "outerwear": 1.9, "shoes": 1.5, "bags": 2.0, "accessories": 1.7},
    "streetwear": {"clothing": 2.6, "outerwear": 2.6, "shoes": 1.8, "bags": 2.0, "accessories": 2.4},
    "outdoor":    {"clothing": 2.2, "outerwear": 3.2, "shoes": 2.0, "bags": 2.2, "accessories": 1.8},
    "designer":   {"clothing": 4.0, "outerwear": 4.5, "shoes": 3.5, "bags": 5.0, "accessories": 4.0},
    "luxus":      {"clothing": 9.0, "outerwear": 11.0, "shoes": 8.0, "bags": 22.0, "accessories": 9.0},
}
FASHION_GROUPS = ("clothing", "outerwear", "shoes", "bags", "accessories")
NO_BRAND = {"", "nobrand", "noname", "ohnemarke", "sansmarque", "andere", "sonstige", "other", "unbekannt",
            "handmade", "selbstgemacht", "vintage", "markenlos", "keinemarke"}
# Wörter, die zu allgemein sind, um daraus im Titel eine Marke zu erkennen
_AMBIGUOUS = {"only", "next", "house", "object", "pieces", "review", "comma", "alive", "george", "gap", "lee",
              "vila", "oui", "opus", "element", "smog", "starter", "majestic", "minimum", "dime", "huf", "rab",
              "hunter", "guess", "coach", "boss", "hugo", "mango", "essentials", "market", "rains", "closed",
              "object", "hm", "nb", "rl", "ami", "acne", "apc", "lv", "kanken", "jordan", "polo"}


@lru_cache(maxsize=1)
def _brand_db() -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    """normalisierter Name -> (Anzeigename, Preisklasse); Aliase -> Anzeigename."""
    path = os.path.join(os.path.dirname(__file__), "data", "brands.json")
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return {}, {}
    brands: dict[str, tuple[str, str]] = {}
    for tier, names in data.items():
        if tier in TIERS and isinstance(names, list):
            for name in names:
                brands.setdefault(normalize(name), (name, tier))
    aliases = {k.lower(): v for k, v in (data.get("aliases") or {}).items()}
    return brands, aliases


def brand_info(brand: str) -> Optional[tuple[str, str]]:
    """'Polo Ralph Lauren' -> ('Polo Ralph Lauren', 'premium'); unbekannt -> None."""
    b = normalize(brand)
    if b in NO_BRAND:
        return None
    brands, aliases = _brand_db()
    if b in brands:
        return brands[b]
    alias = aliases.get((brand or "").lower().strip())
    if alias and normalize(alias) in brands:
        return brands[normalize(alias)]
    words = set(re.findall(r"[a-z0-9]+", (brand or "").lower()))
    best = None
    for key, info in brands.items():
        if (len(key) >= 5 and key in b) or (len(key) < 5 and key in words):
            if best is None or len(key) > len(normalize(best[0])):
                best = info
    return best


def detect_brand(text: str) -> Optional[str]:
    """Marke im Titel finden ('vintage carhartt detroit jacke' -> 'Carhartt')."""
    t = f" {(text or '').lower()} "
    brands, aliases = _brand_db()
    candidates: list[tuple[str, str]] = [(alias, name) for alias, name in aliases.items()]
    candidates += [(name.lower(), name) for name, _tier in brands.values()]
    best: Optional[tuple[str, str]] = None
    for needle, name in candidates:
        if normalize(needle) in _AMBIGUOUS or len(normalize(needle)) < 3:
            continue
        if re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", t):
            if best is None or len(needle) > len(best[0]):
                best = (needle, name)
    return best[1] if best else None


# -- Zustand & Kinder ------------------------------------------------------------------------

CONDITION_FACTORS = [
    ("neu mit etikett", 1.35, "neu mit Etikett"), ("new with tags", 1.35, "neu mit Etikett"),
    ("neu ohne etikett", 1.2, "neu"), ("new without tags", 1.2, "neu"),
    ("sehr gut", 1.0, ""), ("very good", 1.0, ""),
    ("zufriedenstellend", 0.6, "zufriedenstellend"), ("satisfactory", 0.6, "zufriedenstellend"),
    ("gut", 0.85, "gut"), ("good", 0.85, "gut"),
]


def condition_factor(condition: str) -> tuple[float, str]:
    c = (condition or "").lower().strip()
    if not c:
        return 0.95, ""
    for key, factor, label in CONDITION_FACTORS:
        if c == key or key in c:
            return factor, label
    return 0.95, ""


_KIDS_WORDS = re.compile(r"\b(kinder|kids?|baby|babys|junior|jungen|mädchen|maedchen|girls?|boys?|jahre|monate|"
                         r"months|years)\b")


def is_kids(title: str, size: str) -> bool:
    if _KIDS_WORDS.search(f"{title} {size}".lower()):
        return True
    # Kindergrößen 62–176 (Schuhe 35–48 und Damen 32–54 liegen darunter, "W32" zählt nicht)
    for num in re.findall(r"(?<![a-z0-9])(\d{2,3})(?![0-9])", (size or "").lower()):
        if 62 <= int(num) <= 176:
            return True
    return False


# -- Die Schätzung -----------------------------------------------------------------------------

@dataclass
class Estimate:
    base: float               # ohne Zustand/Kinder (dient als Vorwissen für den Marktpreis)
    factor: float             # Zustand × Kinder
    basis: str                # woher die Zahl kommt (für die Meldung)
    confidence: str           # "hoch" / "mittel" / "niedrig"
    ptype: str
    brand: str = ""           # erkannte Marke (Anzeigename)
    tier: Optional[str] = None
    factor_notes: tuple[str, ...] = ()

    @property
    def value(self) -> float:
        return self.base * self.factor

    @property
    def low(self) -> float:
        return self.value * (0.6 if self.confidence == "niedrig" else 0.75)

    @property
    def high(self) -> float:
        return self.value * (1.6 if self.confidence == "niedrig" else 1.3)


def estimate(title: str, brand: str, condition: str = "", size: str = "", ptype: Optional[str] = None,
             explicit: Optional[float] = None) -> Estimate:
    """Ungefährer Wiederverkaufswert eines Artikels – auch ohne vorher gelernte Preise.

    explicit: genauerer Wert aus data/market_prices.json für Marke + Kategorie (falls vorhanden).
    """
    ptype = ptype or product_type(title)
    cat = category(ptype)
    detected = brand if brand_info(brand) else (detect_brand(title) if normalize(brand) in NO_BRAND else None)
    info = brand_info(detected or brand)
    shown_brand = (info[0] if info else (brand if normalize(brand) not in NO_BRAND else "")) or ""
    tier = info[1] if info else None

    if explicit:
        base, basis, conf = float(explicit), f"Preiswissen {shown_brand} {cat.label}".strip(), "mittel"
    elif cat.group in FASHION_GROUPS and tier:
        base = cat.base * TIERS[tier][cat.group]
        basis, conf = f"{cat.label} von {TIER_LABELS[tier]}-Marken", "mittel"
    elif cat.group in FASHION_GROUPS:
        base, basis, conf = cat.base * 0.8, f"{cat.label} ohne bekannte Marke", "niedrig"
    else:
        base, basis = cat.base, f"typischer Preis für {cat.label}"
        conf = "niedrig" if cat.volatile else "mittel"

    notes = []
    factor, cond_label = condition_factor(condition)
    if cond_label and factor != 1.0:
        notes.append(f"Zustand {cond_label} {factor - 1:+.0%}")
    if cat.group in FASHION_GROUPS and is_kids(title, size):
        factor *= 0.45
        notes.append("Kindergröße −55%")
    return Estimate(base=base, factor=factor, basis=basis, confidence=conf, ptype=ptype, brand=shown_brand,
                    tier=tier, factor_notes=tuple(notes))
