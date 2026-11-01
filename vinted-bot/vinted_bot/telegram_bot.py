"""Telegram-Steuerung: Suchen per Chat verwalten und Angebote per Button senden."""

from __future__ import annotations

import html
import logging
import re
import threading
import time
from datetime import date
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

from .config import ConfigError, SearchConfig
from .notify import TelegramNotifier, money

log = logging.getLogger(__name__)

MAX_OFFERS_PER_DAY = 25  # Limit von Vinted

HELP = """<b>🤖 Vinted-Deal-Bot</b>

<b>Suchen</b>
/neu <i>Begriff</i> – neue Suche, z. B.
   <code>/neu nike air max 90 bis 40 score 60</code>
   <code>/neu carhartt jacke ab 20 bis 60</code>
   oder einen Vinted-Link mit Filtern einfügen:
   <code>/neu https://www.vinted.de/catalog?search_text=…</code>
/suchen – alle Suchen anzeigen
/loeschen <i>Nr</i> – Suche löschen
/pause <i>Nr</i> · /weiter <i>Nr</i> – einzelne Suche anhalten/fortsetzen

<b>Bot</b>
/pause · /weiter – alle Meldungen anhalten/fortsetzen
/status – läuft alles?
/hilfe – diese Hilfe

<b>Optionen bei /neu</b>
<code>bis 40</code> Höchstpreis · <code>ab 10</code> Mindestpreis
<code>score 60</code> nur gute Deals (0–100) · <code>markt 50</code> typischer Marktpreis"""


def parse_new_search(text: str) -> SearchConfig:
    """'/neu nike air max bis 40 score 60' -> SearchConfig."""
    text = text.strip()
    if not text:
        raise ConfigError("Bitte einen Suchbegriff oder Vinted-Link angeben, z. B. /neu nike air max bis 40")
    opts: dict[str, Any] = {}
    patterns = {
        # bewusst kein "max": sonst würde aus "air max 90" ein Höchstpreis von 90 €
        "max_price": r"(?:bis|unter|höchstens)\s*(\d+(?:[.,]\d+)?)\s*€?",
        "min_price": r"(?:ab|mindestens)\s*(\d+(?:[.,]\d+)?)\s*€?",
        "min_score": r"score\s*(\d+)",
        "market_price": r"markt(?:preis)?\s*(\d+(?:[.,]\d+)?)\s*€?",
    }
    url_match = re.search(r"https?://\S*vinted\.\S+", text)
    url = url_match.group(0) if url_match else None
    rest = text.replace(url, " ") if url else text
    for key, pat in patterns.items():
        m = re.search(rf"(?<!\S){pat}(?!\S)", rest, flags=re.IGNORECASE)
        if m:
            opts[key] = m.group(1).replace(",", ".")
            rest = rest[: m.start()] + " " + rest[m.end():]
    keywords = " ".join(rest.split())
    data: dict[str, Any] = {**opts}
    if url:
        data["url"] = url
        q = parse_qs(urlparse(url).query)
        name = keywords or " ".join(q.get("search_text", [])).strip() or "Link-Suche"
        if keywords:
            data["keywords"] = keywords
    else:
        if not keywords:
            raise ConfigError("Bitte einen Suchbegriff angeben, z. B. /neu nike air max bis 40")
        data["keywords"] = keywords
        name = keywords
    data["name"] = name[:60]
    return SearchConfig.from_dict(data, source="telegram")


def describe_search(s: SearchConfig) -> str:
    bits = []
    if s.min_price is not None or s.max_price is not None:
        lo = f"{s.min_price:g}" if s.min_price is not None else "0"
        hi = f"{s.max_price:g}" if s.max_price is not None else "∞"
        bits.append(f"{lo}–{hi} €")
    if s.min_score:
        bits.append(f"Score ≥ {s.min_score}")
    if s.market_price:
        bits.append(f"Markt {s.market_price:g} €")
    if s.url:
        bits.append("Vinted-Link")
    return " · ".join(bits)


class TelegramController(threading.Thread):
    def __init__(self, notifier: TelegramNotifier, monitor: Any, account: Any = None):
        super().__init__(daemon=True, name="telegram")
        self.tg = notifier
        self.monitor = monitor
        self.storage = monitor.storage
        self.account = account
        self.chat_id = str(notifier.chat_id or "")
        self.stop_event = threading.Event()

    # -- Schleife ----------------------------------------------------------------

    def run(self) -> None:
        offset = int(self.storage.get_state("tg_offset", "0") or 0)
        while not self.stop_event.is_set():
            try:
                data = self.tg.api("getUpdates", offset=offset, timeout=25,
                                   allowed_updates=["message", "callback_query"])
            except Exception as e:  # noqa: BLE001
                log.debug("getUpdates: %s", e)
                self.stop_event.wait(5)
                continue
            for update in data.get("result", []):
                offset = max(offset, int(update["update_id"]) + 1)
                self.storage.set_state("tg_offset", str(offset))
                try:
                    self.handle_update(update)
                except Exception as e:  # noqa: BLE001
                    log.exception("Fehler bei Telegram-Update: %s", e)

    def stop(self) -> None:
        self.stop_event.set()

    def reply(self, text: str, markup: Optional[dict] = None, chat_id: Optional[str] = None) -> None:
        payload: dict[str, Any] = {"chat_id": chat_id or self.chat_id, "text": text, "parse_mode": "HTML",
                                   "disable_web_page_preview": True}
        if markup:
            payload["reply_markup"] = markup
        self.tg.api("sendMessage", **payload)

    # -- Updates -----------------------------------------------------------------

    def handle_update(self, update: dict) -> None:
        if "callback_query" in update:
            cb = update["callback_query"]
            chat = str(((cb.get("message") or {}).get("chat") or {}).get("id", ""))
            if chat != self.chat_id:
                return
            self.handle_callback(cb)
            return
        msg = update.get("message") or {}
        chat = str((msg.get("chat") or {}).get("id", ""))
        text = (msg.get("text") or "").strip()
        if not text:
            return
        if chat != self.chat_id:
            # Fremde Chats dürfen den Bot nicht steuern – nur die eigene Chat-ID verraten wir für die Einrichtung.
            if text.startswith("/start") and not self.chat_id:
                self.reply(f"Deine Chat-ID ist <code>{chat}</code>.\nTrage sie in der config.yaml bei "
                           "<code>chat_id</code> ein und starte den Bot neu.", chat_id=chat)
            return
        self.handle_command(text)

    def handle_command(self, text: str) -> None:
        cmd, _, arg = text.partition(" ")
        cmd = cmd.split("@")[0].lower()
        arg = arg.strip()
        handlers = {
            "/start": self.cmd_help, "/hilfe": self.cmd_help, "/help": self.cmd_help,
            "/neu": self.cmd_new, "/add": self.cmd_new,
            "/suchen": self.cmd_list, "/liste": self.cmd_list, "/list": self.cmd_list,
            "/loeschen": self.cmd_delete, "/löschen": self.cmd_delete, "/delete": self.cmd_delete,
            "/pause": self.cmd_pause, "/weiter": self.cmd_resume, "/resume": self.cmd_resume,
            "/status": self.cmd_status,
        }
        handler = handlers.get(cmd)
        if handler:
            handler(arg)
        else:
            self.reply("Unbekannter Befehl. /hilfe zeigt alle Befehle.")

    # -- Befehle -----------------------------------------------------------------

    def cmd_help(self, _arg: str = "") -> None:
        self.reply(HELP)

    def _numbered(self) -> list[SearchConfig]:
        return self.monitor.all_searches()

    def _pick(self, arg: str) -> Optional[SearchConfig]:
        searches = self._numbered()
        if arg.isdigit() and 1 <= int(arg) <= len(searches):
            return searches[int(arg) - 1]
        for s in searches:
            if s.name.lower() == arg.lower():
                return s
        self.reply(f"Suche '{html.escape(arg)}' nicht gefunden. /suchen zeigt die Nummern.")
        return None

    def cmd_new(self, arg: str) -> None:
        try:
            search = parse_new_search(arg)
        except ConfigError as e:
            self.reply(html.escape(str(e)))
            return
        existing = {s.name for s in self._numbered()}
        base, n = search.name, 2
        while search.name in existing:
            search.name = f"{base} ({n})"
            n += 1
        self.storage.add_search(search)
        details = describe_search(search)
        self.reply(f"✅ Suche <b>{html.escape(search.name)}</b> angelegt"
                   + (f"\n{html.escape(details)}" if details else "")
                   + "\n\nIch merke mir jetzt die aktuellen Preise und melde dir ab sofort neue Treffer.")

    def cmd_list(self, _arg: str = "") -> None:
        searches = self._numbered()
        if not searches:
            self.reply("Noch keine Suchen. Lege eine an mit\n<code>/neu nike air max bis 40</code>")
            return
        lines = ["<b>Deine Suchen</b>"]
        for i, s in enumerate(searches, 1):
            active = s.enabled and not self.storage.is_disabled(s.name)
            icon = "▶️" if active else "⏸"
            details = describe_search(s)
            lines.append(f"{i}. {icon} <b>{html.escape(s.name)}</b>"
                         + (f" – {html.escape(details)}" if details else "")
                         + (" <i>(config.yaml)</i>" if s.source == "config" else ""))
        if self.monitor.paused:
            lines.append("\n⏸ Alle Meldungen sind pausiert – /weiter zum Fortsetzen.")
        self.reply("\n".join(lines))

    def cmd_delete(self, arg: str) -> None:
        if not arg:
            self.reply("Welche Suche? z. B. <code>/loeschen 2</code> (Nummern siehe /suchen)")
            return
        s = self._pick(arg)
        if not s:
            return
        if s.source == "config":
            self.storage.set_disabled(s.name, True)
            self.reply(f"⏸ <b>{html.escape(s.name)}</b> steht in der config.yaml – ich habe sie angehalten. "
                       "Zum endgültigen Löschen dort entfernen.")
            return
        self.storage.delete_search(s.name)
        self.storage.forget_search(s.name)
        self.reply(f"🗑 Suche <b>{html.escape(s.name)}</b> gelöscht.")

    def cmd_pause(self, arg: str) -> None:
        if not arg:
            self.storage.set_state("paused", "1")
            self.reply("⏸ Alle Meldungen pausiert. /weiter zum Fortsetzen.")
            return
        s = self._pick(arg)
        if s:
            self.storage.set_disabled(s.name, True)
            self.reply(f"⏸ <b>{html.escape(s.name)}</b> angehalten.")

    def cmd_resume(self, arg: str) -> None:
        if not arg:
            self.storage.delete_state("paused")
            self.reply("▶️ Meldungen laufen wieder.")
            return
        s = self._pick(arg)
        if s:
            self.storage.set_disabled(s.name, False)
            self.reply(f"▶️ <b>{html.escape(s.name)}</b> läuft wieder.")

    def cmd_status(self, _arg: str = "") -> None:
        st = self.monitor.stats
        up = int(time.time() - st["started"])
        last = int(time.time() - st["last_cycle"]) if st["last_cycle"] else None
        lines = [
            "<b>Status</b>",
            f"{'⏸ pausiert' if self.monitor.paused else '▶️ läuft'} seit {up // 3600} Std. {up % 3600 // 60} Min.",
            f"Aktive Suchen: {len(self.monitor.active_searches())} von {len(self.monitor.all_searches())}",
            f"Durchläufe: {st['cycles']} · Artikel geprüft: {st['checked']} · Meldungen: {st['alerts']}",
            f"Letzter Durchlauf: vor {last} s" if last is not None else "Erster Durchlauf läuft …",
            f"Angebote per Bot: {'an' if self.account else 'aus'}",
        ]
        if st["last_error"]:
            lines.append(f"Letzter Fehler: {html.escape(str(st['last_error'])[:200])}")
        self.reply("\n".join(lines))

    # -- Buttons -----------------------------------------------------------------

    def _answer(self, cb: dict, text: str = "") -> None:
        try:
            self.tg.api("answerCallbackQuery", callback_query_id=cb["id"], text=text[:190])
        except Exception as e:  # noqa: BLE001
            log.debug("answerCallbackQuery: %s", e)

    def handle_callback(self, cb: dict) -> None:
        data = cb.get("data") or ""
        kind, _, rest = data.partition(":")
        if kind == "no":
            self._answer(cb, "Abgebrochen")
            self._edit(cb, "❌ Angebot abgebrochen.")
            return
        if kind not in ("of", "ok"):
            self._answer(cb)
            return
        try:
            item_id_s, cents_s = rest.split(":")
            item_id, price = int(item_id_s), int(cents_s) / 100
        except ValueError:
            self._answer(cb, "Ungültiger Button")
            return
        item = self.storage.get_item(item_id)
        if not item:
            self._answer(cb, "Artikel nicht mehr gespeichert")
            return
        if not self.account:
            self._answer(cb, "Angebote per Bot sind nicht eingerichtet")
            return
        currency = item.get("currency") or "EUR"
        if kind == "of":  # erst nachfragen – nichts passiert aus Versehen
            self._answer(cb)
            self.reply(f"💸 Angebot über <b>{money(price, currency)}</b> für "
                       f"„{html.escape(item['title'])}“ (aktuell {money(item['price'], currency)}) senden?",
                       markup={"inline_keyboard": [[
                           {"text": "✅ Ja, senden", "callback_data": f"ok:{item_id}:{cents_s}"},
                           {"text": "❌ Abbrechen", "callback_data": "no"},
                       ]]})
            return
        key = f"offers:{date.today().isoformat()}"
        used = int(self.storage.get_state(key, "0") or 0)
        if used >= MAX_OFFERS_PER_DAY:
            self._answer(cb, "Tageslimit erreicht")
            self._edit(cb, f"⚠️ Vinted erlaubt höchstens {MAX_OFFERS_PER_DAY} Angebote pro Tag.")
            return
        self._answer(cb, "Sende Angebot …")
        result = self.account.send_offer(item_id, item.get("seller_id"), price, currency)
        if result.ok:
            self.storage.set_state(key, str(used + 1))
        text = (f"{'✅' if result.ok else '⚠️'} {html.escape(result.message)}\n"
                f"„{html.escape(item['title'])}“ – {money(price, currency)}")
        buttons = [[{"text": "💬 Unterhaltung öffnen", "url": result.conversation_url}]] if result.conversation_url \
            else [[{"text": "👀 Auf Vinted öffnen", "url": item["url"]}]]
        self._edit(cb, text, {"inline_keyboard": buttons})

    def _edit(self, cb: dict, text: str, markup: Optional[dict] = None) -> None:
        msg = cb.get("message") or {}
        payload: dict[str, Any] = {"chat_id": msg.get("chat", {}).get("id"), "message_id": msg.get("message_id"),
                                   "text": text, "parse_mode": "HTML", "disable_web_page_preview": True}
        if markup:
            payload["reply_markup"] = markup
        try:
            self.tg.api("editMessageText", **payload)
        except Exception:  # noqa: BLE001 - z. B. Foto-Nachricht -> neue Nachricht schicken
            self.reply(text, markup)
