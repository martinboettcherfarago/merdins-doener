"""Datenmodell für Vinted-Artikel und das Einlesen der API-Antworten."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class Item:
    id: int
    title: str
    price: float
    currency: str = "EUR"
    total_price: Optional[float] = None  # inkl. Käuferschutz
    brand: str = ""
    size: str = ""
    condition: str = ""
    url: str = ""
    photo_url: Optional[str] = None
    seller_id: Optional[int] = None
    seller_login: str = ""
    favourites: int = 0
    created_ts: Optional[int] = None  # Upload-Zeitpunkt (Unix-Sekunden), falls bekannt
    raw: dict = field(default_factory=dict, repr=False)

    def buy_url(self, base: str) -> str:
        """Direkter Link in den Vinted-Kaufvorgang (Bezahlen bestätigst du selbst)."""
        return f"{base}/transaction/buy/new?source_screen=item&transaction%5Bitem_id%5D={self.id}"


def _money(value: Any) -> tuple[Optional[float], Optional[str]]:
    """Liest Preise im alten ("12.5") und neuen ({"amount": "12.5", "currency_code": "EUR"}) Format."""
    if value is None:
        return None, None
    currency = None
    if isinstance(value, dict):
        currency = value.get("currency_code") or value.get("currency")
        value = value.get("amount")
    try:
        return float(str(value).replace(",", ".")), currency
    except (TypeError, ValueError):
        return None, currency


def _photo(raw: dict) -> tuple[Optional[str], Optional[int]]:
    photo = raw.get("photo")
    if not isinstance(photo, dict):
        photos = raw.get("photos") or []
        photo = photos[0] if photos and isinstance(photos[0], dict) else {}
    url = photo.get("url") or photo.get("full_size_url")
    ts = None
    hi = photo.get("high_resolution")
    if isinstance(hi, dict) and hi.get("timestamp"):
        try:
            ts = int(hi["timestamp"])
        except (TypeError, ValueError):
            ts = None
    return url, ts


def parse_item(raw: dict, web_base: str) -> Optional[Item]:
    """Wandelt einen Eintrag aus der Vinted-Suche in ein :class:`Item` um (None bei kaputten Daten)."""
    try:
        item_id = int(raw.get("id") or raw.get("item_id"))
    except (TypeError, ValueError):
        return None
    price, currency = _money(raw.get("price"))
    if price is None:
        return None
    currency = currency or raw.get("currency") or "EUR"
    total, _ = _money(raw.get("total_item_price"))

    box = raw.get("item_box") or {}
    condition = raw.get("status") if isinstance(raw.get("status"), str) else ""
    size = raw.get("size_title") or (raw.get("size") if isinstance(raw.get("size"), str) else "") or ""
    second = box.get("second_line") or ""
    if not condition and second:  # z. B. "M · Sehr gut"
        parts = [p.strip() for p in second.split("·")]
        condition = parts[-1]
        if len(parts) > 1 and not size:
            size = parts[0]
    brand = raw.get("brand_title") or (raw.get("brand") if isinstance(raw.get("brand"), str) else "") or ""
    if not brand and raw.get("content_source") == "search":
        brand = box.get("first_line") or ""

    url = raw.get("url") or raw.get("path") or f"/items/{item_id}"
    if url.startswith("/"):
        url = web_base + url
    photo_url, ts = _photo(raw)
    user = raw.get("user") or {}
    try:
        seller_id = int(user["id"]) if user.get("id") is not None else None
    except (TypeError, ValueError):
        seller_id = None

    return Item(
        id=item_id,
        title=(raw.get("title") or "").strip(),
        price=price,
        currency=currency,
        total_price=total,
        brand=brand,
        size=size,
        condition=condition,
        url=url,
        photo_url=photo_url,
        seller_id=seller_id,
        seller_login=user.get("login") or "",
        favourites=int(raw.get("favourite_count") or 0),
        created_ts=ts,
        raw=raw,
    )
