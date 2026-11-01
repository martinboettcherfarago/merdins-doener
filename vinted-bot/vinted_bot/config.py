"""Einlesen der config.yaml."""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

import yaml

DEFAULT_EXCLUDE_WORDS = [
    "fake", "replica", "replika", "rep", "nachbau", "inspired", "dupe",
    "defekt", "kaputt", "bastler", "suche", "tausch", "nur tausch",
]


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

    @classmethod
    def from_dict(cls, data: dict[str, Any], source: str = "config") -> "SearchConfig":
        if not isinstance(data, dict):
            raise ConfigError(f"Suche ist kein Objekt: {data!r}")
        name = str(data.get("name") or data.get("keywords") or "").strip()
        if not name:
            raise ConfigError("Jede Suche braucht einen 'name' oder 'keywords'.")
        if not data.get("url") and not data.get("keywords"):
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
        )

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

    names = set()
    for raw in data.get("searches") or []:
        s = SearchConfig.from_dict(raw)
        if s.name in names:
            raise ConfigError(f"Der Suchname '{s.name}' kommt doppelt vor.")
        names.add(s.name)
        cfg.searches.append(s)
    return cfg
