"""EXPERIMENTELL: Preisangebote direkt aus Telegram senden – mit deinem eingeloggten Vinted-Konto.

Vinted hat keine offizielle API. Die Aufrufe hier entsprechen dem, was die Vinted-Webseite
selbst macht, wenn du auf "Preis vorschlagen" klickst. Vinted kann das jederzeit ändern.
Der Bot schickt ein Angebot nur, wenn du in Telegram auf "Ja, senden" tippst.
Gekauft oder bezahlt wird dabei nie etwas.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

from .vinted import HAVE_CURL_CFFI, LOCALES, http_lib, parse_cookie_string

log = logging.getLogger(__name__)

# Diese Konstante schickt die Vinted-Webseite bei jedem API-Aufruf als X-CSRF-Token mit.
DEFAULT_CSRF_TOKEN = "75f6c9fa-dc8e-4e52-a000-e09dd4084b3e"


@dataclass
class OfferResult:
    ok: bool
    message: str
    conversation_url: Optional[str] = None


def _json(r: Any) -> dict:
    try:
        data = r.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _error_text(r: Any) -> str:
    data = _json(r)
    msg = data.get("message") or data.get("error") or ""
    errors = data.get("errors")
    if isinstance(errors, list) and errors:
        first = errors[0]
        msg = msg or (first.get("value") or first.get("message") if isinstance(first, dict) else str(first))
    return f"HTTP {r.status_code}" + (f": {msg}" if msg else "")


def extract_conversation_ids(data: dict) -> tuple[Optional[str], Optional[int]]:
    """Findet Unterhaltungs- und Transaktions-ID in den verschiedenen Antwortformaten."""
    cid = data.get("conversation_id")
    tid = data.get("transaction_id")
    for key in ("conversation", "data"):
        conv = data.get(key)
        if isinstance(conv, dict):
            cid = cid or conv.get("id") or conv.get("conversation_id")
            tx = conv.get("transaction")
            tid = tid or (tx.get("id") if isinstance(tx, dict) else None) or conv.get("transaction_id")
    try:
        tid = int(tid) if tid is not None else None
    except (TypeError, ValueError):
        tid = None
    return (str(cid) if cid else None), tid


class VintedAccount:
    def __init__(self, domain: str, cookies: str, proxy: Optional[str] = None, timeout: float = 20,
                 csrf_token: str = DEFAULT_CSRF_TOKEN, session: Any = None):
        jar = parse_cookie_string(cookies)
        if not (jar.get("access_token_web") or jar.get("refresh_token_web")):
            raise ValueError("In den Cookies fehlt 'access_token_web' bzw. 'refresh_token_web' – "
                             "bist du im Browser bei Vinted eingeloggt?")
        self.web = f"https://www.vinted.{domain}"
        self.core = f"{self.web}/api/v2"
        self.edge = f"https://api.vinted.{domain}"
        self.timeout = timeout
        if session is None:
            if not HAVE_CURL_CFFI:  # pragma: no cover
                raise RuntimeError("Für Angebote wird das Paket 'curl_cffi' benötigt (pip install curl_cffi).")
            session = http_lib.Session(impersonate="chrome")
            if proxy:
                session.proxies = {"http": proxy, "https": proxy}
            for k, v in jar.items():
                session.cookies.set(k, v, domain=f".vinted.{domain}")
        self.session = session
        loc = LOCALES.get(domain, "en-GB")
        self.session.headers.update({
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": f"{loc},{loc.split('-')[0]};q=0.9",
            "Locale": loc,
            "X-CSRF-Token": csrf_token,
            "Origin": self.web,
            "Referer": self.web + "/",
        })
        if jar.get("anon_id"):
            self.session.headers["X-Anon-Id"] = jar["anon_id"]

    def _post(self, url: str, body: dict, retry_auth: bool = True) -> Any:
        r = self.session.request("POST", url, json=body, timeout=self.timeout)
        if r.status_code == 401 and retry_auth and self.refresh():
            return self._post(url, body, retry_auth=False)
        return r

    def refresh(self) -> bool:
        """Holt mit dem refresh_token_web ein frisches access_token_web."""
        try:
            r = self.session.request("POST", f"{self.web}/web/api/auth/refresh", timeout=self.timeout)
        except Exception as e:  # noqa: BLE001
            log.warning("Token-Erneuerung fehlgeschlagen: %s", e)
            return False
        return r.status_code < 300

    def _open_conversation(self, item_id: int, seller_id: int) -> tuple[Optional[str], Optional[int], str]:
        r = self._post(f"{self.edge}/messaging/main/inquiries",
                       {"item_ids": [str(item_id)], "receiver_id": str(seller_id)})
        if r.status_code in (404, 405):  # älterer Weg über die Web-API
            r = self._post(f"{self.core}/conversations", {"initiator": "buyer_enters_offer_form",
                                                          "item_id": str(item_id),
                                                          "opposite_user_id": str(seller_id)})
        if r.status_code >= 300:
            return None, None, _error_text(r)
        cid, tid = extract_conversation_ids(_json(r))
        return cid, tid, ""

    def send_offer(self, item_id: int, seller_id: Optional[int], price: float, currency: str = "EUR") -> OfferResult:
        if not seller_id:
            return OfferResult(False, "Verkäufer unbekannt – bitte direkt auf Vinted anbieten.")
        try:
            cid, tid, err = self._open_conversation(item_id, seller_id)
            if err:
                return OfferResult(False, f"Unterhaltung konnte nicht geöffnet werden ({err}).")
            if not tid:
                return OfferResult(False, "Für diesen Artikel sind keine Angebote möglich.")
            amount = f"{price:.2f}".rstrip("0").rstrip(".")
            r = self._post(f"{self.core}/transactions/{tid}/offer_requests",
                           {"offer_request": {"price": amount, "currency": currency}})
        except Exception as e:  # noqa: BLE001 - Netzwerkfehler sauber melden
            return OfferResult(False, f"Netzwerkfehler: {e}")
        conv_url = f"{self.web}/inbox/{cid}" if cid else None
        if r.status_code >= 300:
            return OfferResult(False, f"Vinted hat das Angebot abgelehnt ({_error_text(r)}).", conv_url)
        return OfferResult(True, "Angebot gesendet ✅", conv_url)
