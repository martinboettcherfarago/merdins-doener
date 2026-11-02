"""🛡 Fake-Ampel: schätzt sofort – ohne Training – wie wahrscheinlich ein Artikel ein Fake ist.

Sie kombiniert typische Warnzeichen, die Fälschungen auf Vinted fast immer haben:
  • Marke, die oft gefälscht wird (Louis Vuitton, Moncler, Stone Island, Jordan, Supreme …)
  • viel zu billig für diese Marke (je stärker gefälscht, desto verdächtiger der Rabatt)
  • Verräter-Wörter im Titel/Text ("1:1", "AAA", "UA", "mirror", "wie original", "alle Größen da" …)
  • "neu mit Etikett" + Spottpreis bei Luxusmarke, Katalog-/Stockfoto statt eigenem Foto
  • das eigene Fake-Modell (sobald trainiert) und – bei rot – der Claude-Bildcheck

Das ist eine Risiko-Ampel, kein Echtheitsbeweis: grün heißt "keine Warnzeichen", nicht "garantiert echt".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Iterable, Optional

from .knowledge import brand_key
from .models import Item
from .text import normalize, rx

# Marke -> (wie oft gefälscht 0..1, Kategorien mit den meisten Fakes – andere zählen weniger)
FAKE_PRONE: dict[str, tuple[float, Optional[tuple[str, ...]]]] = {
    # Luxus-Lederwaren & Schmuck: werden am häufigsten gefälscht
    "louisvuitton": (1.0, None), "chanel": (1.0, None), "hermes": (1.0, None), "goyard": (1.0, None),
    "gucci": (0.9, None), "dior": (0.9, None), "prada": (0.8, None), "fendi": (0.8, None),
    "celine": (0.8, None), "saintlaurent": (0.75, None), "balenciaga": (0.85, None), "bottegaveneta": (0.7, None),
    "loewe": (0.7, None), "miumiu": (0.75, None), "versace": (0.6, None), "givenchy": (0.6, None),
    "burberry": (0.65, None), "moschino": (0.5, None), "rolex": (1.0, None), "cartier": (0.95, None),
    "chromehearts": (1.0, None), "viviennewestwood": (0.8, ("schmuck",)), "vancleef": (1.0, None),
    "pandora": (0.45, ("schmuck",)), "swarovski": (0.3, ("schmuck",)), "michaelkors": (0.35, ("tasche",)),
    "rayban": (0.5, ("brille",)), "longchamp": (0.45, ("tasche",)),
    # Premium-Jacken
    "moncler": (0.95, None), "canadagoose": (0.95, None), "stoneisland": (0.8, None), "cpcompany": (0.5, None),
    "arcteryx": (0.55, ("jacke", "daunenjacke", "fleece")), "thenorthface": (0.45, ("daunenjacke",)),
    "ralphlauren": (0.3, ("tshirt", "hemd", "pullover", "muetze")), "lacoste": (0.25, ("tshirt",)),
    # Hype-Streetwear
    "supreme": (0.85, None), "offwhite": (0.85, None), "bape": (0.9, None), "abathingape": (0.9, None),
    "palmangels": (0.75, None), "fearofgod": (0.65, None), "essentials": (0.65, None), "amiri": (0.7, None),
    "trapstar": (0.7, None), "corteiz": (0.75, None), "hellstar": (0.7, None), "sp5der": (0.7, None),
    "gallerydept": (0.75, None), "represent": (0.45, None), "stussy": (0.3, None),
    # Sneaker
    "jordan": (0.8, ("sneaker",)), "yeezy": (0.9, None), "nike": (0.35, ("sneaker",)),
    "newbalance": (0.25, ("sneaker",)), "ugg": (0.55, ("stiefel", "schuhe")), "drmartens": (0.2, None),
    "asics": (0.15, ("sneaker",)), "salomon": (0.3, ("sneaker",)),
}
# Modelle, die besonders oft gefälscht werden (zählen extra)
HOT_MODELS = [
    (r"jordan ?(?:1|4|11)\b|\baj ?(?:1|4)\b", "Jordan 1/4/11"), (r"\bdunk\b", "Nike Dunk"),
    (r"\byeezy\b", "Yeezy"), (r"tech ?fleece", "Tech Fleece"), (r"\bnuptse\b", "Nuptse"),
    (r"box ?logo|\bbogo\b", "Box Logo"), (r"neverfull|speedy|keepall|pochette", "LV-Klassiker"),
    (r"\bmaya\b|\bmaire\b|\bmontcla\b", "Moncler-Modell"), (r"expedition|chilliwack|langford", "Canada-Goose-Modell"),
    (r"\bmarmont\b|\bdionysus\b", "Gucci-Klassiker"), (r"saddle ?bag|book ?tote", "Dior-Klassiker"),
    (r"re-?edition|re-?nylon", "Prada Re-Nylon"), (r"\bberkin\b|\bkelly\b", "Hermès-Tasche"),
    (r"submariner|daytona|datejust", "Rolex-Modell"), (r"love ?(?:armband|bracelet)|juste un clou", "Cartier-Schmuck"),
    (r"\buggs? (?:mini|ultra|tasman)|\btasman\b", "UGG Mini/Tasman"), (r"\bsamba\b|\bcampus\b", "Adidas-Hype"),
    (r"\bt-?rex\b|\bspider ?(?:hoodie|worldwide)|\bsp5der\b", "Hype-Hoodie"),
]

# (Muster, Gewicht 0..1, Erklärung) – auf Titel + Beschreibung (klein, normalisiert)
TEXT_SIGNALS = [
    (r"\b1\s*[:zu]\s*1\b", 0.9, "„1:1“ im Text"),
    (r"\baaa\+?\b|\btriple a\b", 0.9, "„AAA“ (Fälscher-Qualitätsstufe)"),
    (r"\bua (?:qualit|quality|version)|\bunauthori[sz]ed authentic", 0.9, "„UA“ (unauthorized authentic)"),
    (r"\bmirror(?: ?quality)?\b|\bspiegelqualit", 0.9, "„mirror quality“"),
    (r"\brepli[ck]a\b|\breps?\b|\brepro\b", 0.95, "Replica/Rep"),
    (r"\binspired\b|\bdupe\b|\bnachgemacht\b|\bnachbau\b|\bimitat\b|\bstyle like\b|\bim stil von\b", 0.9,
     "Nachahmung (inspired/dupe/Imitat)"),
    (r"\b(?:nicht|kein|keine|not) (?:100 ?% ?)?(?:original|orginal|echt|authentic|authentisch)\b", 0.95,
     "„nicht original“"),
    (r"wei(?:ss|ß) nicht,? ob (?:es |sie |er |die |der |das )?(?:echt|original|orginal)", 0.75,
     "Verkäufer weiß nicht, ob echt"),
    (r"echtheit (?:ist )?(?:nicht|unbekannt|ungepr|unklar)|keine garantie (?:auf|f(?:u|ü)r) (?:die )?(?:echtheit|originalit)",
     0.7, "keine Echtheits-Garantie"),
    (r"wie (?:ein |das )?original|kaum vom original|sieht aus wie original|original ?getreu", 0.6, "„wie original“"),
    (r"alle gr(?:ö|o)(?:ß|ss)en (?:verf|vorhanden|da|auf lager|lieferbar)|in allen gr(?:ö|o)(?:ß|ss)en", 0.55,
     "„alle Größen verfügbar“ (Händler-Ware)"),
    (r"mehrere (?:st(?:ü|u)ck |teile )?(?:vorhanden|verf(?:ü|u)gbar|da|auf lager)|\bauf lager\b|\bgro(?:ß|ss)handel\b|"
     r"\bwholesale\b|\bnur heute\b", 0.4, "Händler-Formulierung (mehrere auf Lager)"),
    (r"\btop ?qualit(?:ä|a)t\b|\bbeste qualit(?:ä|a)t\b|\bpremium qualit(?:ä|a)t\b|\bhigh quality\b", 0.25,
     "„Top Qualität“"),
    (r"\bohne (?:box|karton|rechnung)\b.{0,30}\b(?:neu|new)\b", 0.15, "neu, aber ohne Box/Rechnung"),
]
# Belege, die echte Teile oft haben (senken das Preis-Risiko ein wenig – Fälscher behaupten aber auch "100% original")
PROOF = re.compile(r"\b(?:rechnung|kassenbon|kaufbeleg|quittung|echtheitszertifikat|zertifikat|legit ?check(?:ed)?|"
                   r"entrupy|authentifiziert|vinted ?(?:echtheits)?pr(?:ü|u)fung|dustbag mit rechnung)\b")

LEVELS = (("grün", 0.35), ("gelb", 0.65), ("rot", 1.01))
EMOJI = {"grün": "🟢", "gelb": "🟡", "rot": "🔴"}
WORDS = {"grün": "unauffällig", "gelb": "genau prüfen", "rot": "hohes Fake-Risiko"}
MODES = ("streng", "warnen", "aus")
TIER_FALLBACK = {"luxus": 0.75, "designer": 0.45}
# Marken-Namen, die im Titel auch etwas anderes bedeuten können ("Basic Essentials", "Supreme Qualität")
TITLE_SKIP = {"essentials", "represent", "supreme", "celine", "kelly", "spider"}


@dataclass
class FakeCheck:
    risk: float = 0.0
    level: str = "grün"
    reasons: list[str] = field(default_factory=list)
    prone: float = 0.0          # wie oft diese Marke/Kategorie gefälscht wird (0..1)

    @property
    def emoji(self) -> str:
        return EMOJI[self.level]

    @property
    def visible(self) -> bool:
        """Nur zeigen, wenn es etwas zu sagen gibt (Warnung) oder die Marke oft gefälscht wird."""
        return self.level != "grün" or self.prone >= 0.75

    def line(self) -> str:
        text = f"🛡 Fake-Ampel: {self.emoji} {WORDS[self.level]}"
        if self.level != "grün" or self.risk >= 0.15:
            text += f" ({self.risk:.0%})"
        if self.reasons and self.level != "grün":
            text += " – " + " · ".join(self.reasons[:3])
        elif self.level == "grün" and self.prone >= 0.75:
            text += " – oft gefälschte Marke, trotzdem Etikett & Nähte checken"
        return text


def _price_factor(discount: float) -> float:
    """Wie verdächtig ist der Rabatt gegenüber dem geschätzten Wert? (vor Marken-Gewichtung)"""
    for limit, factor in ((0.9, 0.85), (0.8, 0.65), (0.7, 0.45), (0.55, 0.22), (0.4, 0.08)):
        if discount >= limit:
            return factor
    return 0.0


def _effective(entry: tuple[float, Optional[tuple[str, ...]]], ptype: str) -> float:
    weight, hot_types = entry
    return weight * (0.45 if hot_types and ptype not in hot_types else 1.0)


def brand_risk(brand: str, ptype: str, tier: Optional[str] = None, title: str = "") -> tuple[float, str]:
    """Fälschungs-Häufigkeit dieser Marke in dieser Kategorie (0..1) + gefundenes Hype-Modell."""
    key = brand_key(brand) if brand else ""
    weight = _effective(FAKE_PRONE.get(key, (TIER_FALLBACK.get(tier or "", 0.0), None)), ptype)
    # Oft gefälschte Marke im Titel? ("Nike Air Jordan 1" -> Jordan, "Moncler Daunenjacke" mit Marke "Andere")
    words = [w for w in (normalize(x) for x in re.split(r"[\s/,|+()]+", title)) if w]
    joined = {"".join(words[i:i + n]) for n in (1, 2, 3) for i in range(len(words))}
    for k, entry in FAKE_PRONE.items():
        if k in joined and k not in TITLE_SKIP:
            weight = max(weight, _effective(entry, ptype))
    model = ""
    low = f" {title.lower()} "
    for pattern, label in HOT_MODELS:
        if rx(pattern).search(low):
            model = label
            weight = min(1.0, max(weight * 1.2, 0.3))
            break
    return weight, model


def _combine(parts: Iterable[float]) -> float:
    keep = 1.0
    for p in parts:
        keep *= 1.0 - max(0.0, min(0.99, p))
    return 1.0 - keep


def check(item: Item, brand: str = "", ptype: str = "", discount: Optional[float] = None, tier: Optional[str] = None,
          tags: Optional[list[Any]] = None, model_fake: Optional[float] = None, text: str = "") -> FakeCheck:
    """Fake-Risiko eines Artikels. discount = wie weit unter dem geschätzten Wert (0.8 = 80 % billiger)."""
    title = item.title or ""
    desc = text or str((item.raw or {}).get("description") or "")
    low = f" {(title + ' ' + desc).lower()} "
    weight, model = brand_risk(brand or item.brand, ptype, tier, title)
    parts: list[float] = []
    reasons: list[str] = []

    # 1) Verräter-Wörter (gelten für jede Marke)
    for pattern, p, why in TEXT_SIGNALS:
        if rx(pattern).search(low):
            # "Top Qualität" & Co. nur bei Marken verdächtig, die gefälscht werden
            p = p if p >= 0.5 else p * min(1.0, weight * 2)
            if p >= 0.05:
                parts.append(p)
                reasons.append(why)

    # 2) Viel zu billig für eine oft gefälschte Marke
    d = discount or 0.0
    proof = bool(PROOF.search(low))
    if weight > 0 and d > 0:
        p = weight * _price_factor(d) * (0.75 if proof else 1.0)
        if p >= 0.05:
            parts.append(p)
            label = brand or item.brand or "die Marke"
            reasons.append(f"{d:.0%} unter Wert – sehr billig für {label}" + (f" ({model})" if model else ""))

    # 3) "Neu mit Etikett" zum Spottpreis bei Fälscher-Marken
    cond = (item.condition or "").lower()
    if weight >= 0.3 and d >= 0.5 and ("etikett" in cond or "tags" in cond):
        parts.append(0.25 if d >= 0.75 else 0.12)
        reasons.append("„neu mit Etikett“ zum Spottpreis")

    # 4) Foto: Katalog-/Stockfoto statt eigenem Foto (Fälscher klauen Shop-Bilder)
    if tags and weight >= 0.3 and d >= 0.4:
        stock = next((t.prob for t in tags if getattr(t, "label", "") == "Produktfoto"), 0.0)
        if stock >= 0.55:
            parts.append(0.3 * stock)
            reasons.append("Katalog-/Stockfoto statt eigenem Foto")

    # 5) Eigenes Fake-Modell (aus deinen /fake-Markierungen und Claude-Urteilen gelernt)
    if model_fake is not None and model_fake >= 0.3:
        parts.append(0.9 * model_fake)
        reasons.append(f"eigenes Fake-Modell {model_fake:.0%}")

    risk = _combine(parts)
    level = next(name for name, limit in LEVELS if risk < limit)
    if proof and level == "grün" and weight:
        reasons.append("Rechnung/Echtheitsnachweis erwähnt")
    order = sorted(range(len(reasons)), key=lambda i: -(parts[i] if i < len(parts) else 0))
    return FakeCheck(risk=risk, level=level, reasons=[reasons[i] for i in order], prone=weight)
