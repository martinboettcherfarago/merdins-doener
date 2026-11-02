"""Zugriff auf die (inoffizielle) Vinted-Web-API für die Suche."""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

from .config import SearchConfig
from .models import Item, parse_item

log = logging.getLogger(__name__)

try:  # curl_cffi imitiert einen echten Chrome-Browser -> deutlich weniger Blockaden
    from curl_cffi import requests as http_lib

    HAVE_CURL_CFFI = True
except ImportError:  # pragma: no cover - Fallback, falls curl_cffi fehlt
    import requests as http_lib  # type: ignore

    HAVE_CURL_CFFI = False

LOCALES = {
    "de": "de-DE", "at": "de-AT", "fr": "fr-FR", "es": "es-ES", "it": "it-IT", "nl": "nl-NL",
    "be": "fr-BE", "pl": "pl-PL", "pt": "pt-PT", "co.uk": "en-GB", "com": "en-US", "lt": "lt-LT",
    "cz": "cs-CZ", "lu": "fr-LU", "se": "sv-SE", "dk": "da-DK", "fi": "fi-FI",
}
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

# URL-Parameter, die keine Filter-Listen sind
_SCALAR_KEYS = {"search_text", "price_from", "price_to", "currency"}
_IGNORED_KEYS = {"order", "page", "per_page", "time", "search_id", "search_by_image_uuid",
                 "disabled_personalization", "ref", "source", "referrer"}


class VintedError(Exception):
    pass


class VintedBlocked(VintedError):
    """Vinted blockt die Anfragen (Captcha / 403)."""


class VintedRateLimited(VintedError):
    def __init__(self, retry_after: float):
        super().__init__(f"Zu viele Anfragen, warte {retry_after:.0f}s")
        self.retry_after = retry_after


@dataclass
class SearchQuery:
    search_text: str = ""
    price_from: Optional[float] = None
    price_to: Optional[float] = None
    currency: Optional[str] = None
    filters: dict[str, list[str]] = field(default_factory=dict)  # z. B. {"brand": ["53"], "size": ["207"]}

    def legacy_params(self, per_page: int, page: int = 1) -> dict[str, Any]:
        """Parameter für /api/v2/catalog/items."""
        p = self._base(per_page, page)
        for code, ids in self.filters.items():
            p[f"{code}_ids"] = ",".join(ids)
        return p

    def edge_params(self, per_page: int, page: int = 1) -> dict[str, Any]:
        """Parameter für api.vinted.<tld>/svc-catalogue/items."""
        p = self._base(per_page, page)
        for code, ids in self.filters.items():
            p[f"attribute_ids[{code}]"] = ",".join(ids)
        return p

    def _base(self, per_page: int, page: int) -> dict[str, Any]:
        p: dict[str, Any] = {"search_text": self.search_text, "order": "newest_first",
                             "page": page, "per_page": per_page}
        if self.price_from is not None:
            p["price_from"] = _fmt_num(self.price_from)
        if self.price_to is not None:
            p["price_to"] = _fmt_num(self.price_to)
        if self.currency and (self.price_from is not None or self.price_to is not None):
            p["currency"] = self.currency
        return p


def _fmt_num(v: float) -> str:
    return str(int(v)) if float(v).is_integer() else f"{v:.2f}"


def _filter_code(key: str) -> str:
    """'brand_ids[]' -> 'brand', 'status[]' -> 'status', 'catalog[]' -> 'catalog'."""
    code = key.removesuffix("[]")
    for suffix in ("_ids", "_id"):
        if code.endswith(suffix):
            code = code[: -len(suffix)]
            break
    return code


def query_from_url(url: str) -> SearchQuery:
    """Übernimmt alle Filter aus einem Vinted-Such-Link, den du im Browser kopiert hast."""
    parsed = urlparse(url.strip())
    qs = parse_qs(parsed.query)
    q = SearchQuery()
    q.search_text = " ".join(qs.get("search_text", [])).strip()
    for key, target in (("price_from", "price_from"), ("price_to", "price_to")):
        if qs.get(key):
            try:
                setattr(q, target, float(qs[key][0].replace(",", ".")))
            except ValueError:
                pass
    if qs.get("currency"):
        q.currency = qs["currency"][0]

    for key, values in qs.items():
        base = key.removesuffix("[]")
        if base in _SCALAR_KEYS or base in _IGNORED_KEYS:
            continue
        code = _filter_code(key)
        ids = [x for v in values for x in v.split(",") if x.strip()]
        if ids:
            q.filters.setdefault(code, [])
            q.filters[code].extend(i for i in ids if i not in q.filters[code])

    # Kategorie- bzw. Marken-ID im Pfad, z. B. /catalog/79-pullover oder /brand/53-nike
    for segment, code in (("catalog", "catalog"), ("brand", "brand")):
        m = re.search(rf"/{segment}/(\d+)", parsed.path)
        if m and m.group(1) not in q.filters.get(code, []):
            q.filters.setdefault(code, []).append(m.group(1))
    return q


def query_for_search(search: SearchConfig, currency: str) -> SearchQuery:
    q = query_from_url(search.url) if search.url else SearchQuery()
    if search.keywords:
        q.search_text = search.keywords
    if search.min_price is not None:
        q.price_from = search.min_price
    if search.max_price is not None:
        q.price_to = search.max_price
    if not q.currency:
        q.currency = currency
    return q


def parse_cookie_string(cookies: str) -> dict[str, str]:
    """'a=1; b=2' (aus den Browser-Entwicklertools kopiert) -> {'a': '1', 'b': '2'}."""
    out: dict[str, str] = {}
    for part in (cookies or "").split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            if k.strip():
                out[k.strip()] = v.strip()
    return out


class VintedClient:
    """Durchsucht Vinted wie ein normaler Browser-Besucher (ohne Login)."""

    def __init__(self, domain: str = "de", proxy: Optional[str] = None, timeout: float = 20.0):
        self.domain = domain
        self.web_base = f"https://www.vinted.{domain}"
        self.edge_base = f"https://api.vinted.{domain}"
        self.proxy = proxy
        self.timeout = timeout
        self.locale = LOCALES.get(domain, "en-GB")
        self._session: Any = None
        self._mode = "legacy"  # wechselt automatisch auf "edge", falls Vinted den alten Endpunkt abschaltet

    # -- Sitzung ---------------------------------------------------------------

    def _new_session(self) -> Any:
        if HAVE_CURL_CFFI:
            s = http_lib.Session(impersonate="chrome")
        else:  # pragma: no cover
            s = http_lib.Session()
            s.headers["User-Agent"] = UA
        s.headers.update({
            "Accept-Language": f"{self.locale},{self.locale.split('-')[0]};q=0.9",
        })
        if self.proxy:
            s.proxies = {"http": self.proxy, "https": self.proxy}
        # Startseite laden -> Vinted setzt die anonymen Sitzungs-Cookies (access_token_web)
        r = s.get(self.web_base + "/", timeout=self.timeout,
                  headers={"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"})
        if r.status_code == 403:
            raise VintedBlocked("Vinted blockiert den Zugriff (403 auf der Startseite).")
        return s

    def reset(self) -> None:
        self._session = None

    # -- Suche -----------------------------------------------------------------

    def search(self, query: SearchQuery, per_page: int = 48, page: int = 1) -> list[Item]:
        """Neueste Artikel zur Suche (neueste zuerst)."""
        data = self._get_catalog(query, per_page, page)
        items = []
        for raw in data.get("items") or []:
            if not isinstance(raw, dict):
                continue
            item = parse_item(raw, self.web_base)
            if item is not None:
                items.append(item)
        return items

    def _get_catalog(self, query: SearchQuery, per_page: int, page: int = 1) -> dict:
        last_error: Optional[Exception] = None
        for attempt in range(3):
            if self._mode == "legacy":
                url, params = f"{self.web_base}/api/v2/catalog/items", query.legacy_params(per_page, page)
            else:
                url, params = f"{self.edge_base}/svc-catalogue/items", query.edge_params(per_page, page)
            try:
                if self._session is None:
                    self._session = self._new_session()
                r = self._session.get(url, params=params, timeout=self.timeout, headers={
                    "Accept": "application/json, text/plain, */*",
                    "Referer": self.web_base + "/catalog",
                    "Origin": self.web_base,
                })
            except VintedBlocked as e:
                last_error = e
                self.reset()
                time.sleep(3 + attempt * 5)
                continue
            except Exception as e:  # noqa: BLE001 - Netzwerkfehler (DNS, Timeout, Proxy …)
                last_error = VintedError(f"Netzwerkfehler: {e}")
                self.reset()
                time.sleep(2 + attempt * 2)
                continue
            status = r.status_code
            if status == 200:
                try:
                    data = r.json()
                except ValueError:
                    # HTML statt JSON -> meistens eine Captcha-Seite
                    last_error = VintedBlocked("Vinted hat eine Captcha-Seite statt Daten geschickt.")
                    self.reset()
                    time.sleep(2 + attempt * 3)
                    continue
                return data if isinstance(data, dict) else {}
            if status in (404, 410) and self._mode == "legacy":
                log.info("Alter Such-Endpunkt nicht verfügbar (%s) – wechsle auf neue Vinted-API.", status)
                self._mode = "edge"
                continue
            if status == 401:
                last_error = VintedError("Sitzung abgelaufen (401)")
                self.reset()
                continue
            if status == 403:
                last_error = VintedBlocked("Vinted blockiert gerade die Anfragen (403).")
                self.reset()
                time.sleep(3 + attempt * 5)
                continue
            if status == 429:
                try:
                    retry_after = float(r.headers.get("Retry-After") or 60)
                except ValueError:
                    retry_after = 60.0
                raise VintedRateLimited(retry_after)
            last_error = VintedError(f"Vinted antwortet mit HTTP {status}")
            time.sleep(2 + attempt * 2)
        raise last_error or VintedError("Unbekannter Fehler bei der Vinted-Suche")


    # -- Fotos (für den KI-Bildcheck) ---------------------------------------------

    def item_photos(self, item: Item, limit: int = 4) -> list[str]:
        """Bis zu `limit` Foto-Links eines Artikels (Etiketten & Details sind für den Echtheits-Check wichtig)."""
        urls: list[str] = []

        def add(url: Any) -> None:
            if isinstance(url, str) and url.startswith("http") and url not in urls:
                urls.append(url)

        for p in (item.raw or {}).get("photos") or []:
            if isinstance(p, dict):
                add(p.get("full_size_url") or p.get("url"))
        if len(urls) < 2:
            try:
                if self._session is None:
                    self._session = self._new_session()
                r = self._session.get(f"{self.web_base}/api/v2/items/{item.id}", timeout=self.timeout,
                                      headers={"Accept": "application/json"})
                if r.status_code == 200:
                    data = r.json()
                    for p in ((data.get("item") or {}).get("photos") or []):
                        if isinstance(p, dict):
                            add(p.get("full_size_url") or p.get("url"))
            except Exception as e:  # noqa: BLE001
                log.debug("Foto-Liste über API nicht verfügbar: %s", e)
        if len(urls) < 2:
            try:
                r = self._session.get(item.url, timeout=self.timeout,
                                      headers={"Accept": "text/html,application/xhtml+xml"})
                if r.status_code == 200:
                    for m in re.findall(r"https://images\d*\.vinted\.net/[^\"'\s<>]+?\.(?:jpe?g|webp|png)[^\"'\s<>]*",
                                        r.text):
                        add(m.replace("\\u0026", "&").replace("&amp;", "&"))
            except Exception as e:  # noqa: BLE001
                log.debug("Foto-Liste über Artikelseite nicht verfügbar: %s", e)
        if not urls and item.photo_url:
            add(item.photo_url)
        return urls[:limit]

    def fetch_bytes(self, url: str) -> Optional[bytes]:
        if self._session is None:
            self._session = self._new_session()
        r = self._session.get(url, timeout=self.timeout, headers={"Accept": "image/avif,image/webp,image/*,*/*"})
        return r.content if r.status_code == 200 else None
