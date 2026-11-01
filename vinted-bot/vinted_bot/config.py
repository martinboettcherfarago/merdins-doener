"""Einlesen der config.yaml."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field, replace
from typing import Any, Optional

import yaml

DEFAULT_EXCLUDE_WORDS = [
    "fake", "replica", "replika", "rep", "nachbau", "inspired", "dupe",
    "defekt", "kaputt", "bastler", "suche", "tausch", "nur tausch",
]


# Eingebaute Trend-Liste: Marken UND angesagte Modelle/Styles, nach denen auf Vinted gesucht wird.
# Eine Marke allein ("Carhartt") beobachtet alle neuen Artikel dieser Marke; ein Begriff
# ("Vintage Lederjacke") sucht genau danach. Per Telegram änderbar: /trends plus … / /trends minus …
TREND_WATCHES = [
    # Marken, die sich gut weiterverkaufen
    "Carhartt", "Stüssy", "Arc'teryx", "The North Face", "Patagonia", "Ralph Lauren", "Lacoste",
    "Stone Island", "C.P. Company", "Barbour", "Levi's", "Dickies", "Moncler", "Burberry", "Miu Miu",
    "Vivienne Westwood",
    # angesagte Modelle & Styles
    "Nike Tech Fleece", "Nike ACG", "Vintage Nike", "Adidas Trainingsjacke", "Ralph Lauren Strick",
    "Polo Bear", "Longchamp Le Pliage", "Prada Nylon", "Coach Tasche", "Ed Hardy", "Diesel vintage",
    "Vintage Lederjacke", "Vintage Trikot", "College Jacke", "Band Shirt vintage", "Harley Davidson", "Y2K",
    "Vintage Levi's", "Bootcut Jeans",
    # Y2K, Tops & Felljacken
    "Abercrombie & Fitch", "Fellkragen Jacke", "Lammfell Jacke", "Wildlederjacke", "Juicy Couture",
    "Brandy Melville", "Skims", "Lululemon", "True Religion", "Miss Sixty", "Y2K Top", "Korsett Top",
    "Spitzen Top", "Y2K Cargo", "Y2K Minirock", "Tommy Hilfiger vintage", "Champion vintage",
]
TREND_BRANDS = TREND_WATCHES  # alter Name, bleibt für ältere Konfigurationen gültig

# Schnäppchen-Stufen für Resale-Suchen (per Telegram: /stufe streng)
RESALE_LEVELS: dict[str, dict[str, Any]] = {
    "locker": {"max_age_minutes": 20, "min_discount": 30.0, "min_cheaper_than": 75.0, "min_profit": 10.0,
               "min_condition": "zufriedenstellend"},
    "normal": {"max_age_minutes": 10, "min_discount": 40.0, "min_cheaper_than": 90.0, "min_profit": 15.0,
               "min_condition": "gut"},
    "streng": {"max_age_minutes": 5, "min_discount": 50.0, "min_cheaper_than": 95.0, "min_profit": 20.0,
               "min_condition": "gut"},
}
RESALE_DEFAULTS = RESALE_LEVELS["normal"]

# Standard-Filter für das Schnäppchen-Radar (Marken & Trends) – per Telegram änderbar (/groesse, /ohne, /mit)
DEFAULT_SIZES = ["S", "M", "L"]
DEFAULT_EXCLUDE_TYPES = ["schuhe"]
RESALE_TARGET_KEYS = tuple(RESALE_DEFAULTS)


class ConfigError(Exception):
    pass


@dataclass
class SearchConfig:
    name: str
    url: Optional[str] = None            # Vinted-Such-Link aus dem Browser (mit allen Filtern)
    keywords: Optional[str] = None       # oder einfach Suchbegriffe
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    market_price: Optional[float] = None  # typischer Preis -> genauere Deal-Bewertung
    brands: list[str] = field(default_factory=list)       # nur diese Marken
    sizes: list[str] = field(default_factory=list)        # nur diese Größen
    must_contain: list[str] = field(default_factory=list)  # alle Wörter müssen im Titel stehen
    exclude_words: list[str] = field(default_factory=list)
    min_score: int = 0                   # nur Deals ab diesem Score (0-100) melden
    enabled: bool = True
    source: str = "config"               # "config" oder "telegram"
    mode: str = "standard"               # "standard" oder "resale"
    min_discount: Optional[float] = None  # mind. x % unter Marktpreis
    min_profit: Optional[float] = None    # mind. x € Gewinn-Potenzial beim Weiterverkauf
    max_age_minutes: Optional[int] = None  # nur Artikel, die höchstens so alt sind
    min_condition: Optional[str] = None   # z. B. "sehr gut" -> schlechtere Zustände ignorieren
    min_cheaper_than: Optional[float] = None  # günstiger als x % aller vergleichbaren Angebote
    sweep: bool = False                    # Alles-Radar: neueste Uploads ohne Suchbegriff

    @property
    def is_resale(self) -> bool:
        return self.mode == "resale"

    @classmethod
    def from_dict(cls, data: dict[str, Any], source: str = "config") -> "SearchConfig":
        if not isinstance(data, dict):
            raise ConfigError(f"Suche ist kein Objekt: {data!r}")
        sweep = bool(data.get("sweep", False))
        name = str(data.get("name") or data.get("keywords") or ("Alles-Radar" if sweep else "")).strip()
        if not name:
            raise ConfigError("Jede Suche braucht einen 'name' oder 'keywords'.")
        if not data.get("url") and not data.get("keywords") and not sweep:
            raise ConfigError(f"Suche '{name}': bitte 'url' oder 'keywords' angeben.")

        def _list(key: str) -> list[str]:
            v = data.get(key) or []
            if isinstance(v, str):
                v = [v]
            return [str(x).strip() for x in v if str(x).strip()]

        def _num(key: str) -> Optional[float]:
            v = data.get(key)
            if v is None or v == "":
                return None
            try:
                return float(v)
            except (TypeError, ValueError):
                raise ConfigError(f"Suche '{name}': '{key}' muss eine Zahl sein, nicht {v!r}.")

        mode = str(data.get("mode") or "standard").strip().lower()
        if mode not in ("standard", "resale"):
            raise ConfigError(f"Suche '{name}': 'mode' muss 'standard' oder 'resale' sein.")
        age = _num("max_age_minutes")
        return cls(
            name=name,
            url=data.get("url") or None,
            keywords=data.get("keywords") or None,
            min_price=_num("min_price"),
            max_price=_num("max_price"),
            market_price=_num("market_price"),
            brands=_list("brands"),
            sizes=_list("sizes"),
            must_contain=_list("must_contain"),
            exclude_words=_list("exclude_words"),
            min_score=int(data.get("min_score") or 0),
            enabled=bool(data.get("enabled", True)),
            source=source,
            mode=mode,
            min_discount=_num("min_discount"),
            min_profit=_num("min_profit"),
            max_age_minutes=int(age) if age is not None else None,
            min_condition=str(data["min_condition"]).strip() if data.get("min_condition") else None,
            min_cheaper_than=_num("min_cheaper_than"),
            sweep=sweep,
        )

    @classmethod
    def resale_for_brand(cls, brand: str, source: str = "config", **overrides: Any) -> "SearchConfig":
        """Schnäppchen-Suche für eine Marke oder einen Trend-Begriff (siehe watch)."""
        return cls.watch(brand, source=source, **overrides)

    @classmethod
    def watch(cls, entry: str, source: str = "config", **overrides: Any) -> "SearchConfig":
        """Schnäppchen-Suche: nur frische Artikel weit unter ihrem geschätzten Wert.

        "Carhartt"            -> Marke · Carhartt   (alle neuen Carhartt-Artikel, nur echte Carhartt)
        "Vintage Lederjacke"  -> Trend · Vintage Lederjacke (genau dieser Suchbegriff)
        "Nike Tech Fleece"    -> Trend · Nike Tech Fleece (Suchbegriff, nur echte Nike)
        Nicht angegebene Ziele (Rabatt, Frische, …) kommen zur Laufzeit aus der Schnäppchen-Stufe.
        """
        entry = " ".join(str(entry).split())
        brand = brand_of_watch(entry)
        data: dict[str, Any] = {"name": watch_name(entry), "keywords": entry, "mode": "resale"}
        if brand:
            data["brands"] = [brand]
        data.update({k: v for k, v in overrides.items() if v is not None})
        return cls.from_dict(data, source=source)

    def with_targets(self, targets: dict[str, Any]) -> "SearchConfig":
        """Füllt bei Resale-Suchen nicht gesetzte Ziele mit den Werten der aktuellen Stufe."""
        if not self.is_resale:
            return self
        missing = {k: v for k, v in targets.items() if k in RESALE_TARGET_KEYS and getattr(self, k) is None}
        return replace(self, **missing) if missing else self

    def to_dict(self) -> dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if v not in (None, [], "") and k != "source"}


@dataclass
class Config:
    domain: str = "de"
    interval_seconds: int = 60
    max_item_age_minutes: int = 60
    per_page: int = 48
    proxy: Optional[str] = None
    price_drop_percent: float = 10.0
    top_deal_score: int = 75
    shipping_estimate: float = 5.0       # geschätzte Versandkosten für die Gewinn-Rechnung
    resale_targets: dict[str, Any] = field(default_factory=lambda: dict(RESALE_DEFAULTS))
    filter_sizes: list[str] = field(default_factory=lambda: list(DEFAULT_SIZES))       # [] = alle Größen
    filter_exclude_types: list[str] = field(default_factory=lambda: list(DEFAULT_EXCLUDE_TYPES))
    only_rare: bool = False
    global_exclude_words: list[str] = field(default_factory=lambda: list(DEFAULT_EXCLUDE_WORDS))

    telegram_token: str = ""
    telegram_chat_id: str = ""
    discord_webhook: str = ""
    ntfy_topic: str = ""
    ntfy_server: str = "https://ntfy.sh"

    account_enabled: bool = False
    account_cookies: str = ""
    offer_discounts: list[int] = field(default_factory=lambda: [10, 20])

    database: str = "vinted_bot.db"
    searches: list[SearchConfig] = field(default_factory=list)

    @property
    def web_base(self) -> str:
        return f"https://www.vinted.{self.domain}"

    @property
    def currency(self) -> str:
        return {"co.uk": "GBP", "pl": "PLN", "cz": "CZK", "se": "SEK", "dk": "DKK",
                "hu": "HUF", "ro": "RON", "com": "USD"}.get(self.domain, "EUR")


def normalize_domain(value: str) -> str:
    """'https://www.vinted.de/' / 'vinted.de' / 'de' -> 'de'."""
    v = (value or "de").strip().lower()
    v = v.removeprefix("https://").removeprefix("http://").split("/")[0]
    v = v.removeprefix("www.").removeprefix("vinted.")
    return v or "de"


def load_config(path: str) -> Config:
    if not os.path.exists(path):
        raise ConfigError(
            f"Konfigurationsdatei '{path}' nicht gefunden. "
            "Kopiere config.example.yaml nach config.yaml und trage deine Daten ein."
        )
    with open(path, encoding="utf-8") as f:
        try:
            data = yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise ConfigError(f"config.yaml ist kein gültiges YAML: {e}")
    if not isinstance(data, dict):
        raise ConfigError("config.yaml muss oben Schlüssel wie 'vinted:' und 'searches:' enthalten.")
    return config_from_dict(data, base_dir=os.path.dirname(os.path.abspath(path)))


def config_from_dict(data: dict[str, Any], base_dir: str = ".") -> Config:
    v = data.get("vinted") or {}
    n = data.get("notifications") or {}
    tg = n.get("telegram") or {}
    dc = n.get("discord") or {}
    nt = n.get("ntfy") or {}
    sc = data.get("scoring") or {}
    acc = data.get("account") or {}

    cfg = Config(
        domain=normalize_domain(str(v.get("domain") or "de")),
        interval_seconds=max(20, int(v.get("interval_seconds") or 60)),
        max_item_age_minutes=int(v.get("max_item_age_minutes") or 60),
        per_page=min(96, max(10, int(v.get("per_page") or 48))),
        proxy=v.get("proxy") or None,
        price_drop_percent=float(sc.get("price_drop_percent") or 10),
        top_deal_score=int(sc.get("top_deal_score") or 75),
        telegram_token=str(tg.get("token") or os.environ.get("TELEGRAM_TOKEN") or "").strip(),
        telegram_chat_id=str(tg.get("chat_id") or os.environ.get("TELEGRAM_CHAT_ID") or "").strip(),
        discord_webhook=str(dc.get("webhook_url") or "").strip(),
        ntfy_topic=str(nt.get("topic") or "").strip(),
        ntfy_server=str(nt.get("server") or "https://ntfy.sh").rstrip("/"),
        account_enabled=bool(acc.get("enabled", False)),
        account_cookies=str(acc.get("cookies") or os.environ.get("VINTED_COOKIES") or "").strip(),
        offer_discounts=[int(x) for x in (acc.get("offer_discounts") or [10, 20])],
    )
    if "global_exclude_words" in sc:
        cfg.global_exclude_words = [str(w) for w in (sc.get("global_exclude_words") or [])]

    db = str(data.get("database") or "vinted_bot.db")
    cfg.database = db if os.path.isabs(db) else os.path.join(base_dir, db)

    searches = [SearchConfig.from_dict(raw) for raw in data.get("searches") or []]
    searches += resale_searches(data.get("resale") or {})
    names = set()
    for s in searches:
        if s.name in names:
            raise ConfigError(f"Der Suchname '{s.name}' kommt doppelt vor.")
        names.add(s.name)
    cfg.searches = searches
    section = data.get("resale") or {}
    cfg.shipping_estimate = float(section.get("shipping_estimate") or 5.0)
    level = str(section.get("level") or "normal").strip().lower()
    if level not in RESALE_LEVELS:
        raise ConfigError(f"resale → level muss {', '.join(RESALE_LEVELS)} sein, nicht '{level}'.")
    cfg.resale_targets = dict(RESALE_LEVELS[level])
    filters = data.get("filters") or {}
    if "sizes" in filters:
        sizes = filters.get("sizes") or []
        sizes = [sizes] if isinstance(sizes, str) else sizes
        cfg.filter_sizes = [] if any(str(x).lower() in ("alle", "all", "*") for x in sizes) \
            else [str(x).strip().upper() for x in sizes if str(x).strip()]
    if "exclude_types" in filters:
        types = filters.get("exclude_types") or []
        cfg.filter_exclude_types = [str(t).strip().lower() for t in ([types] if isinstance(types, str) else types)]
    cfg.only_rare = bool(filters.get("only_rare", False))
    for key in RESALE_TARGET_KEYS:  # einzelne Werte aus der config überschreiben die Stufe
        if section.get(key) is not None:
            value = section[key]
            cfg.resale_targets[key] = (str(value) if key == "min_condition"
                                       else int(value) if key == "max_age_minutes" else float(value))
    return cfg


def is_brand_entry(entry: str) -> bool:
    """Ist der Eintrag genau eine Marke (und kein Suchbegriff wie 'Vintage Nike')?"""
    from .catalog import _brand_db, brand_info
    info = brand_info(entry)
    if not info:
        return False
    _brands, aliases = _brand_db()
    return normalize_name(info[0]) == normalize_name(entry) or entry.lower().strip() in aliases


def brand_of_watch(entry: str) -> Optional[str]:
    """Marke, auf die eine Suche beschränkt wird ('Nike Tech Fleece' -> 'Nike', 'Y2K' -> None)."""
    from .catalog import brand_info, detect_brand
    if is_brand_entry(entry):
        return entry
    found = detect_brand(entry)
    return brand_info(found)[0] if found and brand_info(found) else None


def watch_name(entry: str) -> str:
    return f"{'Marke' if is_brand_entry(entry) else 'Trend'} · {' '.join(str(entry).split())}"


def resale_name(brand: str) -> str:  # alter Name
    return watch_name(brand)


def normalize_name(text: str) -> str:
    from .text import normalize
    return normalize(text)


def resale_searches(section: dict[str, Any]) -> list[SearchConfig]:
    """Der 'resale:'-Abschnitt: eine Resale-Suche pro Marke ('trends' = eingebaute Trend-Liste)."""
    if not isinstance(section, dict) or not section.get("enabled", True) or not section.get("brands"):
        return []
    brands = section["brands"]
    if isinstance(brands, str):
        brands = [brands]
    # Rabatt/Frische/Gewinn kommen aus der Stufe (resale_targets), hier nur Preis- und Größenfilter
    overrides = {k: section.get(k) for k in ("min_price", "max_price", "sizes", "exclude_words")}
    out = []
    for brand in brands:
        brand = str(brand).strip()
        if brand.lower() in ("trends", "trend"):
            out += [SearchConfig.watch(b, **overrides) for b in TREND_WATCHES]
        elif brand:
            out.append(SearchConfig.watch(brand, **overrides))
    for term in section.get("keywords") or []:  # zusätzliche Trend-Begriffe
        if str(term).strip():
            out.append(SearchConfig.watch(str(term), **overrides))
    if section.get("radar"):  # Alles-Radar: neueste Uploads ohne Suchbegriff
        radar = section["radar"]
        out.append(SearchConfig.from_dict({"name": "Alles-Radar", "sweep": True, "mode": "resale",
                                           "url": radar if isinstance(radar, str) else None, **{
                                               k: v for k, v in overrides.items() if v is not None}}))
    # doppelte Marken (z. B. "trends" + "Nike") nur einmal
    unique: dict[str, SearchConfig] = {}
    for s in out:
        unique.setdefault(s.name, s)
    return list(unique.values())
