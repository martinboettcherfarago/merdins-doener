"""Benachrichtigungen: Telegram (mit Buttons), Discord und ntfy (Push aufs Handy)."""

from __future__ import annotations

import html
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import requests

from .models import Item
from .scoring import DealScore, _sym

log = logging.getLogger(__name__)


@dataclass
class Alert:
    item: Item
    search_name: str
    score: DealScore
    buy_url: str
    kind: str = "new"                 # "new" oder "price_drop"
    old_price: Optional[float] = None
    offers: list[float] = field(default_factory=list)


def money(value: Optional[float], currency: str = "EUR") -> str:
    if value is None:
        return "?"
    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".") + f" {_sym(currency)}"


def age_text(created_ts: Optional[int], now: Optional[float] = None) -> str:
    if not created_ts:
        return ""
    minutes = max(0, int(((now or time.time()) - created_ts) // 60))
    if minutes < 1:
        return "gerade eben"
    if minutes < 60:
        return f"vor {minutes} Min."
    hours = minutes // 60
    if hours < 48:
        return f"vor {hours} Std."
    return f"vor {hours // 24} Tagen"


def headline(alert: Alert) -> str:
    s = alert.score
    if alert.kind == "price_drop":
        return (f"📉 PREIS GESENKT · {money(alert.old_price, alert.item.currency)} → "
                f"{money(alert.item.price, alert.item.currency)} · Score {s.total}/100")
    if s.is_top:
        return f"🔥 TOP-DEAL · Score {s.total}/100"
    return f"🆕 Neu · Score {s.total}/100"


def detail_lines(alert: Alert, now: Optional[float] = None) -> list[str]:
    it = alert.item
    price_line = f"💶 {money(it.price, it.currency)}"
    if it.total_price and it.total_price > it.price:
        price_line += f"  (mit Käuferschutz {money(it.total_price, it.currency)})"
    lines = [price_line]
    lines += [f"📊 {r}" for r in alert.score.reasons]
    meta = " · ".join(x for x in (it.brand, f"Gr. {it.size}" if it.size else "", it.condition) if x)
    if meta:
        lines.append(f"🏷 {meta}")
    extra = " · ".join(x for x in (f"❤️ {it.favourites} Favoriten" if it.favourites else "",
                                   f"⏱ {age_text(it.created_ts, now)}" if it.created_ts else "",
                                   f"👤 {it.seller_login}" if it.seller_login else "") if x)
    if extra:
        lines.append(extra)
    lines.append(f"🔎 Suche: {alert.search_name}")
    return lines


def telegram_caption(alert: Alert, now: Optional[float] = None) -> str:
    title = alert.item.title if len(alert.item.title) <= 120 else alert.item.title[:117] + "…"
    parts = [f"<b>{html.escape(headline(alert))}</b>", f"<b>{html.escape(title)}</b>", ""]
    parts += [html.escape(line) for line in detail_lines(alert, now)]
    caption = "\n".join(parts)
    return caption[:1020]


def telegram_keyboard(alert: Alert, offers_via_bot: bool) -> dict[str, Any]:
    it = alert.item
    rows: list[list[dict[str, str]]] = [[
        {"text": "🛒 Jetzt kaufen", "url": alert.buy_url},
        {"text": "👀 Ansehen", "url": it.url},
    ]]
    if offers_via_bot and alert.offers:
        rows.append([{"text": f"💸 {money(p, it.currency)} anbieten", "callback_data": f"of:{it.id}:{int(round(p * 100))}"}
                     for p in alert.offers])
    else:
        rows.append([{"text": "💸 Preis vorschlagen", "url": it.url}])
    return {"inline_keyboard": rows}


class TelegramNotifier:
    def __init__(self, token: str, chat_id: str, offers_via_bot: bool = False, timeout: float = 20):
        self.token = token
        self.chat_id = chat_id
        self.offers_via_bot = offers_via_bot
        self.timeout = timeout
        self.base_url = "https://api.telegram.org"
        self.http = requests.Session()

    def api(self, method: str, **payload: Any) -> dict:
        # getUpdates wartet bis zu 25 s auf neue Nachrichten -> Timeout entsprechend länger
        timeout = self.timeout + int(payload.get("timeout") or 0)
        r = self.http.post(f"{self.base_url}/bot{self.token}/{method}", json=payload, timeout=timeout)
        try:
            data = r.json()
        except ValueError:
            data = {"ok": False, "description": f"HTTP {r.status_code}"}
        if not data.get("ok"):
            raise RuntimeError(f"Telegram {method}: {data.get('description')}")
        return data

    def send_alert(self, alert: Alert) -> None:
        caption = telegram_caption(alert)
        markup = telegram_keyboard(alert, self.offers_via_bot)
        if alert.item.photo_url:
            try:
                self.api("sendPhoto", chat_id=self.chat_id, photo=alert.item.photo_url, caption=caption,
                         parse_mode="HTML", reply_markup=markup)
                return
            except RuntimeError as e:  # z. B. Bild nicht abrufbar -> ohne Bild senden
                log.debug("sendPhoto fehlgeschlagen, sende Text: %s", e)
        self.api("sendMessage", chat_id=self.chat_id, text=caption, parse_mode="HTML",
                 reply_markup=markup, disable_web_page_preview=False)

    def send_text(self, text: str, reply_markup: Optional[dict] = None) -> None:
        payload: dict[str, Any] = {"chat_id": self.chat_id, "text": text, "parse_mode": "HTML",
                                   "disable_web_page_preview": True}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        self.api("sendMessage", **payload)


class DiscordNotifier:
    def __init__(self, webhook_url: str, timeout: float = 20):
        self.url = webhook_url
        self.timeout = timeout

    def send_alert(self, alert: Alert) -> None:
        it = alert.item
        desc = "\n".join(detail_lines(alert))
        desc += f"\n\n**[🛒 Jetzt kaufen]({alert.buy_url})** · [👀 Ansehen / Preis vorschlagen]({it.url})"
        embed: dict[str, Any] = {
            "title": f"{headline(alert)}\n{it.title}"[:256],
            "url": it.url,
            "description": desc[:4000],
            "color": 0xE5484D if alert.score.is_top or alert.kind == "price_drop" else 0x09B1BA,
        }
        if it.photo_url:
            embed["image"] = {"url": it.photo_url}
        r = requests.post(self.url, json={"embeds": [embed]}, timeout=self.timeout)
        r.raise_for_status()

    def send_text(self, text: str, reply_markup: Optional[dict] = None) -> None:
        plain = html.unescape(text.replace("<b>", "**").replace("</b>", "**"))
        requests.post(self.url, json={"content": plain[:1900]}, timeout=self.timeout).raise_for_status()


class NtfyNotifier:
    """Push aufs Handy ohne Konto: App 'ntfy' installieren und das Thema abonnieren."""

    def __init__(self, server: str, topic: str, timeout: float = 20):
        self.server = server.rstrip("/")
        self.topic = topic
        self.timeout = timeout

    def send_alert(self, alert: Alert) -> None:
        it = alert.item
        payload: dict[str, Any] = {
            "topic": self.topic,
            "title": f"{headline(alert)} – {it.title}"[:250],
            "message": "\n".join(detail_lines(alert)),
            "tags": ["fire"] if alert.score.is_top else ["shopping"],
            "priority": 5 if alert.score.is_top else 3,
            "click": it.url,
            "actions": [
                {"action": "view", "label": "🛒 Kaufen", "url": alert.buy_url},
                {"action": "view", "label": "👀 Ansehen", "url": it.url},
            ],
        }
        if it.photo_url:
            payload["attach"] = it.photo_url
        requests.post(self.server, json=payload, timeout=self.timeout).raise_for_status()

    def send_text(self, text: str, reply_markup: Optional[dict] = None) -> None:
        plain = html.unescape(text.replace("<b>", "").replace("</b>", ""))
        requests.post(self.server, json={"topic": self.topic, "message": plain}, timeout=self.timeout).raise_for_status()


class MultiNotifier:
    """Schickt jede Nachricht an alle eingerichteten Kanäle; ein Fehler stoppt die anderen nicht."""

    def __init__(self, notifiers: list[Any]):
        self.notifiers = notifiers

    def __bool__(self) -> bool:
        return bool(self.notifiers)

    def send_alert(self, alert: Alert) -> bool:
        ok = False
        for n in self.notifiers:
            try:
                n.send_alert(alert)
                ok = True
            except Exception as e:  # noqa: BLE001 - ein Kanal darf die anderen nicht blockieren
                log.warning("%s: Benachrichtigung fehlgeschlagen: %s", type(n).__name__, e)
        return ok

    def send_text(self, text: str) -> None:
        for n in self.notifiers:
            try:
                n.send_text(text)
            except Exception as e:  # noqa: BLE001
                log.warning("%s: Nachricht fehlgeschlagen: %s", type(n).__name__, e)
