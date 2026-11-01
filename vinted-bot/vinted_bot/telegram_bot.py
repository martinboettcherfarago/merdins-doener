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

from .config import TREND_BRANDS, ConfigError, SearchConfig
from .notify import TelegramNotifier, money
from .scoring import normalize

log = logging.getLogger(__name__)

MAX_OFFERS_PER_DAY = 25  # Limit von Vinted

HELP = """<b>🤖 Vinted-Deal-Bot</b>

<b>💰 Resale (frisch &amp; weit unter Marktpreis)</b>
/marke <i>Name</i> – Marke beobachten, z. B.
   <code>/marke stone island</code>
   <code>/marke carhartt bis 80 rabatt 50 gewinn 20</code>
/trends – eingebaute Liste angesagter Resale-Marken
/trends an · /trends aus – alle Trend-Marken beobachten / entfernen

<b>🔎 Normale Suchen</b>
/neu <i>Begriff</i> – neue Suche, z. B.
   <code>/neu nike air max 90 bis 40 score 60</code>
   oder einen Vinted-Link mit Filtern einfügen:
   <code>/neu https://www.vinted.de/catalog?search_text=…</code>
/suchen – alle Suchen anzeigen
/loeschen <i>Nr</i> – Suche löschen
/pause <i>Nr</i> · /weiter <i>Nr</i> – einzelne Suche anhalten/fortsetzen

<b>Bot</b>
/pause · /weiter – alle Meldungen anhalten/fortsetzen
/status – läuft alles?

<b>Optionen</b>
<code>bis 40</code> Höchstpreis · <code>ab 10</code> Mindestpreis
<code>rabatt 40</code> mind. 40 % unter Marktpreis · <code>gewinn 15</code> mind. 15 € Gewinn
<code>frisch 10</code> nur Artikel jünger als 10 Min. · <code>score 60</code> Mindest-Score
<code>markt 50</code> typischer Marktpreis"""

# bewusst kein "max": sonst würde aus "air max 90" ein Höchstpreis von 90 €
OPTION_PATTERNS = {
    "max_price": r"(?:bis|unter|höchstens)\s*(\d+(?:[.,]\d+)?)\s*€?",
    "min_price": r"(?:ab|mindestens)\s*(\d+(?:[.,]\d+)?)\s*€?",
    "min_score": r"score\s*(\d+)",
    "market_price": r"markt(?:preis)?\s*(\d+(?:[.,]\d+)?)\s*€?",
    "min_discount": r"rabatt\s*(\d+(?:[.,]\d+)?)\s*%?",
    "min_profit": r"gewinn\s*(\d+(?:[.,]\d+)?)\s*€?",
    "max_age_minutes": r"frisch\s*(\d+)\s*(?:min\.?|minuten)?",
}


def extract_options(text: str) -> tuple[str, dict[str, Any]]:
    """Zieht Optionen wie 'bis 40' oder 'rabatt 50' aus dem Text. Gibt (Resttext, Optionen) zurück."""
    opts: dict[str, Any] = {}
    rest = text
    for key, pat in OPTION_PATTERNS.items():
        m = re.search(rf"(?<!\S){pat}(?!\S)", rest, flags=re.IGNORECASE)
        if m:
            opts[key] = m.group(1).replace(",", ".")
            rest = rest[: m.start()] + " " + rest[m.end():]
    return " ".join(rest.split()), opts


def parse_new_search(text: str) -> SearchConfig:
    """'/neu nike air max bis 40 score 60' -> SearchConfig."""
    text = text.strip()
    if not text:
        raise ConfigError("Bitte einen Suchbegriff oder Vinted-Link angeben, z. B. /neu nike air max bis 40")
    url_match = re.search(r"https?://\S*vinted\.\S+", text)
    url = url_match.group(0) if url_match else None
    keywords, opts = extract_options(text.replace(url, " ") if url else text)
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


def parse_brand_watch(text: str) -> SearchConfig:
    """'/marke stone island bis 200 rabatt 50' -> Resale-Suche für die Marke."""
    brand, opts = extract_options(text.strip())
    if not brand:
        raise ConfigError("Welche Marke? z. B. /marke carhartt oder /marke stone island bis 150")
    brand = next((b for b in TREND_BRANDS if normalize(b) == normalize(brand)), brand.title())
    return SearchConfig.resale_for_brand(brand[:40], source="telegram", **opts)


def describe_search(s: SearchConfig) -> str:
    bits = []
    if s.is_resale:
        bits.append("💰 Resale")
    if s.min_price is not None or s.max_price is not None:
        lo = f"{s.min_price:g}" if s.min_price is not None else "0"
        hi = f"{s.max_price:g}" if s.max_price is not None else "∞"
        bits.append(f"{lo}–{hi} €")
    if s.min_discount:
        bits.append(f"≥ {s.min_discount:g} % unter Markt")
    if s.min_profit:
        bits.append(f"≥ {s.min_profit:g} € Gewinn")
    if s.max_age_minutes:
        bits.append(f"max. {s.max_age_minutes} Min. alt")
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
            "/marke": self.cmd_brand, "/brand": self.cmd_brand, "/resale": self.cmd_brand,
            "/trends": self.cmd_trends, "/trend": self.cmd_trends,
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
        self._add(search)

    def cmd_brand(self, arg: str) -> None:
        try:
            search = parse_brand_watch(arg)
        except ConfigError as e:
            self.reply(html.escape(str(e)))
            return
        if search.name in {s.name for s in self._numbered()}:
            self.reply(f"<b>{html.escape(search.name)}</b> wird schon beobachtet. /suchen zeigt alle.")
            return
        self._add(search)

    def cmd_trends(self, arg: str) -> None:
        existing = {s.name: s for s in self._numbered()}
        arg = arg.lower().strip()
        if arg in ("an", "on", "start", "alle"):
            added = []
            for brand in TREND_BRANDS:
                s = SearchConfig.resale_for_brand(brand, source="telegram")
                if s.name not in existing:
                    self.storage.add_search(s)
                    added.append(brand)
            self.reply(f"✅ {len(added)} Trend-Marken werden jetzt beobachtet"
                       + (f": {html.escape(', '.join(added))}" if added else " (waren schon alle aktiv)")
                       + "\n\nGemeldet wird nur, was gerade frisch hochgeladen wurde (≤ 10 Min.), mind. 40 % unter "
                       "Marktpreis liegt und ca. 15 € Gewinn bringt. Den Marktpreis je Marke und Produkttyp "
                       "lernt der Bot in den ersten Durchläufen.")
            return
        if arg in ("aus", "off", "stop"):
            removed = 0
            for brand in TREND_BRANDS:
                name = SearchConfig.resale_for_brand(brand).name
                if name in existing and existing[name].source == "telegram":
                    self.storage.delete_search(name)
                    self.storage.forget_search(name)
                    removed += 1
            self.reply(f"🗑 {removed} Trend-Marken entfernt.")
            return
        lines = ["<b>🔥 Trend-Marken für Resale</b>"]
        for brand in TREND_BRANDS:
            name = SearchConfig.resale_for_brand(brand).name
            active = name in existing and not self.storage.is_disabled(name)
            lines.append(f"{'✅' if active else '▫️'} {html.escape(brand)}")
        lines.append("\n/trends an – alle beobachten · /trends aus – alle entfernen\n"
                     "Einzelne Marke: <code>/marke stüssy</code>")
        self.reply("\n".join(lines))

    def _add(self, search: SearchConfig) -> None:
        existing = {s.name for s in self._numbered()}
        base, n = search.name, 2
        while search.name in existing:
            search.name = f"{base} ({n})"
            n += 1
        self.storage.add_search(search)
        details = describe_search(search)
        hint = ("Ich lerne jetzt die Marktpreise dieser Marke und melde dir nur frisch hochgeladene "
                "Schnäppchen." if search.is_resale else
                "Ich merke mir jetzt die aktuellen Preise und melde dir ab sofort neue Treffer.")
        self.reply(f"✅ Suche <b>{html.escape(search.name)}</b> angelegt"
                   + (f"\n{html.escape(details)}" if details else "") + f"\n\n{hint}")

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
