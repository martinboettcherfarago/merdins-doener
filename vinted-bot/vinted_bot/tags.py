"""Bild-Tags ohne Training: Das Mode-Bildmodell (Marqo-FashionSigLIP) vergleicht jedes Foto mit diesen
Beschreibungen und erkennt so Kategorie, Farbe, Material, Muster, Stil, Jahrzehnt, Details und Fotoart.

(Deutsches Etikett, englische Beschreibung fürs Modell, ggf. passende Kategorie im Bot)
"""

from __future__ import annotations

from typing import Optional

TagDef = tuple[str, str, Optional[str]]

TAG_GROUPS: dict[str, list[TagDef]] = {
    "kategorie": [
        ("Jacke", "a photo of a jacket", "jacke"),
        ("Trainingsjacke", "a photo of a track jacket with zipper", "jacke"),
        ("Windbreaker", "a photo of a nylon windbreaker jacket", "jacke"),
        ("Daunenjacke", "a photo of a quilted puffer down jacket", "daunenjacke"),
        ("Lederjacke", "a photo of a leather jacket", "lederjacke"),
        ("Jeansjacke", "a photo of a denim jacket", "jacke"),
        ("Fleecejacke", "a photo of a fleece jacket", "fleece"),
        ("Mantel", "a photo of a long coat", "mantel"),
        ("Trenchcoat", "a photo of a trench coat", "mantel"),
        ("Blazer", "a photo of a blazer", "blazer"),
        ("Weste", "a photo of a vest or gilet", "weste"),
        ("Hoodie", "a photo of a hoodie", "hoodie"),
        ("Sweatshirt", "a photo of a crewneck sweatshirt", "pullover"),
        ("Strickpullover", "a photo of a knitted sweater", "pullover"),
        ("Strickjacke", "a photo of a cardigan", "pullover"),
        ("T-Shirt", "a photo of a t-shirt", "tshirt"),
        ("Poloshirt", "a photo of a polo shirt", "tshirt"),
        ("Hemd", "a photo of a button-up shirt", "hemd"),
        ("Trikot", "a photo of a football jersey", "trikot"),
        ("Top", "a photo of a tank top or camisole", "top"),
        ("Korsett-Top", "a photo of a corset top", "top"),
        ("Bluse", "a photo of a blouse", "top"),
        ("Kleid", "a photo of a dress", "kleid"),
        ("Rock", "a photo of a skirt", "rock"),
        ("Jeans", "a photo of jeans", "jeans"),
        ("Cargohose", "a photo of cargo pants", "hose"),
        ("Jogginghose", "a photo of track pants or sweatpants", "jogginghose"),
        ("Hose", "a photo of trousers", "hose"),
        ("Shorts", "a photo of shorts", "shorts"),
        ("Bademode", "a photo of swimwear", "bademode"),
        ("Sneaker", "a photo of sneakers", "sneaker"),
        ("Stiefel", "a photo of boots", "stiefel"),
        ("Sandalen", "a photo of sandals", "sandalen"),
        ("Pumps", "a photo of high heels", "schuhe"),
        ("Handtasche", "a photo of a handbag", "tasche"),
        ("Rucksack", "a photo of a backpack", "rucksack"),
        ("Geldbörse", "a photo of a wallet", "geldboerse"),
        ("Gürtel", "a photo of a belt", "guertel"),
        ("Cap", "a photo of a baseball cap", "muetze"),
        ("Mütze", "a photo of a beanie", "muetze"),
        ("Fischerhut", "a photo of a bucket hat", "muetze"),
        ("Schal", "a photo of a scarf", "schal"),
        ("Sonnenbrille", "a photo of sunglasses", "brille"),
        ("Uhr", "a photo of a wristwatch", "uhr"),
        ("Schmuck", "a photo of jewelry", "schmuck"),
        ("Patch/Sticker", "a photo of an embroidered patch or a sticker", "kleinkram"),
        ("Karton/Verpackung", "a photo of an empty shoe box or packaging", "verpackung"),
        ("Buch/Magazin", "a photo of a book or magazine", "buch"),
        ("Konsole/Elektronik", "a photo of a game console or electronics", "elektronik"),
    ],
    "farbe": [
        ("schwarz", "a photo of black clothing", None), ("weiß", "a photo of white clothing", None),
        ("grau", "a photo of grey clothing", None), ("beige", "a photo of beige clothing", None),
        ("braun", "a photo of brown clothing", None), ("dunkelblau", "a photo of navy blue clothing", None),
        ("blau", "a photo of blue clothing", None), ("hellblau", "a photo of light blue clothing", None),
        ("grün", "a photo of green clothing", None), ("oliv", "a photo of olive green clothing", None),
        ("rot", "a photo of red clothing", None), ("bordeaux", "a photo of burgundy clothing", None),
        ("rosa", "a photo of pink clothing", None), ("lila", "a photo of purple clothing", None),
        ("gelb", "a photo of yellow clothing", None), ("orange", "a photo of orange clothing", None),
        ("bunt", "a photo of multicolor colorblock clothing", None),
    ],
    "material": [
        ("Denim", "clothing made of denim", None), ("Leder", "clothing made of leather", None),
        ("Wildleder", "clothing made of suede", None), ("Nylon", "clothing made of shiny nylon", None),
        ("Fleece", "clothing made of fleece", None), ("Strick/Wolle", "clothing made of knitted wool", None),
        ("Baumwolle", "clothing made of cotton jersey", None), ("Satin/Seide", "clothing made of satin silk", None),
        ("Cord", "clothing made of corduroy", None), ("Canvas", "clothing made of heavy canvas", None),
        ("gesteppt", "quilted padded clothing", None), ("Kunstfell", "clothing made of faux fur", None),
        ("Mesh", "clothing made of mesh", None), ("Samt", "clothing made of velvet", None),
    ],
    "muster": [
        ("uni", "plain solid color clothing", None), ("gestreift", "striped clothing", None),
        ("kariert", "plaid checked clothing", None), ("Camouflage", "camouflage pattern clothing", None),
        ("Blumen", "floral print clothing", None), ("Leopard", "leopard print clothing", None),
        ("großes Logo", "clothing with a big logo print", None), ("Grafik-Print", "clothing with a graphic print", None),
        ("Colorblock", "colorblock clothing", None), ("Batik", "tie-dye clothing", None),
    ],
    "stil": [
        ("Streetwear", "streetwear fashion", None), ("Vintage", "vintage second-hand clothing", None),
        ("Sportswear", "retro sportswear", None), ("Gorpcore", "technical outdoor gorpcore clothing", None),
        ("Workwear", "workwear clothing", None), ("Y2K", "y2k fashion", None), ("Preppy", "preppy fashion", None),
        ("Grunge", "grunge fashion", None), ("Boho", "boho fashion", None), ("Business", "formal business wear", None),
        ("Luxus", "luxury designer fashion", None), ("Skater", "skater fashion", None),
        ("Techwear", "black techwear", None), ("Basic", "basic everyday clothing", None),
    ],
    "jahrzehnt": [
        ("70er", "1970s vintage fashion", None), ("80er", "1980s vintage fashion", None),
        ("90er", "1990s vintage fashion", None), ("Y2K/2000er", "early 2000s y2k fashion", None),
        ("aktuell", "modern contemporary fashion", None),
    ],
    "details": [
        ("Kapuze", "clothing with a hood", None), ("Reißverschluss", "clothing with a full zipper", None),
        ("Logo-Stickerei", "clothing with an embroidered logo", None), ("Badge/Patch", "clothing with a patch badge", None),
        ("Ärmelstreifen", "clothing with stripes on the sleeves", None), ("Fellkragen", "a jacket with a fur collar", None),
        ("oversized", "oversized baggy fit clothing", None), ("cropped", "cropped short clothing", None),
        ("Cargotaschen", "clothing with cargo pockets", None),
    ],
    "foto": [
        ("Produktfoto", "a professional studio product photo on a plain white background", None),
        ("Handyfoto", "an amateur photo of clothing lying on a bed or floor at home", None),
        ("getragen", "a person wearing the clothes in a mirror selfie", None),
        ("Etikett-Nahaufnahme", "a close-up photo of a clothing label or care tag", None),
        ("unscharf/dunkel", "a blurry dark low quality photo", None),
    ],
}

# Ab dieser Wahrscheinlichkeit (innerhalb der Gruppe) gilt ein Tag als erkannt
THRESHOLDS = {"kategorie": 0.35, "farbe": 0.3, "material": 0.35, "muster": 0.4, "stil": 0.3, "jahrzehnt": 0.45,
              "details": 0.35, "foto": 0.45}
SHOWN_GROUPS = ("kategorie", "material", "farbe", "muster", "jahrzehnt", "stil", "details")


def count_tags() -> int:
    return sum(len(v) for v in TAG_GROUPS.values())


# Wie stark ein erkanntes Merkmal für "cool & gefragt" (Resale-Sicht) spricht – negativ = eher langweilig.
COOL_WEIGHTS: dict[tuple[str, str], float] = {
    ("jahrzehnt", "70er"): 1.0, ("jahrzehnt", "80er"): 1.0, ("jahrzehnt", "90er"): 1.0,
    ("jahrzehnt", "Y2K/2000er"): 0.9, ("jahrzehnt", "aktuell"): -0.4,
    ("stil", "Vintage"): 0.6, ("stil", "Sportswear"): 0.5, ("stil", "Gorpcore"): 0.5, ("stil", "Workwear"): 0.5,
    ("stil", "Y2K"): 0.5, ("stil", "Grunge"): 0.4, ("stil", "Skater"): 0.4, ("stil", "Streetwear"): 0.3,
    ("stil", "Techwear"): 0.3, ("stil", "Luxus"): 0.3, ("stil", "Preppy"): 0.2, ("stil", "Boho"): 0.1,
    ("stil", "Basic"): -0.5, ("stil", "Business"): -0.4,
    ("details", "Fellkragen"): 0.4, ("details", "Ärmelstreifen"): 0.4, ("details", "Logo-Stickerei"): 0.3,
    ("details", "Badge/Patch"): 0.3, ("details", "Cargotaschen"): 0.2, ("details", "oversized"): 0.1,
    ("muster", "Colorblock"): 0.4, ("muster", "großes Logo"): 0.3, ("muster", "Camouflage"): 0.3,
    ("muster", "Leopard"): 0.3, ("muster", "Batik"): 0.2, ("muster", "kariert"): 0.2, ("muster", "uni"): -0.1,
    ("material", "Leder"): 0.3, ("material", "Wildleder"): 0.3, ("material", "Kunstfell"): 0.3,
    ("material", "Cord"): 0.3, ("material", "Nylon"): 0.2, ("material", "Denim"): 0.2, ("material", "Samt"): 0.2,
    ("material", "Satin/Seide"): 0.2, ("material", "gesteppt"): 0.1,
    ("foto", "unscharf/dunkel"): -0.3,
}
COOL_THRESHOLD = 0.6   # ab hier gilt der Look als "cool" (z. B. 90er + Sportswear oder Vintage + Leder + Fellkragen)


def cool_score(tags: list) -> tuple[float, list[str]]:
    """Cool-Faktor 0–1 aus den Foto-Tags + die Merkmale, die dafür sprechen (stärkste zuerst)."""
    total, good = 0.0, []
    for t in tags:
        w = COOL_WEIGHTS.get((t.group, t.label), 0.0)
        total += w * t.prob
        if w > 0:
            good.append((w * t.prob, t.label))
    return max(0.0, min(1.0, total)), [label for _, label in sorted(good, reverse=True)]
