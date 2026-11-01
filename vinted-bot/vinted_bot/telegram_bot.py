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

from .config import RESALE_LEVELS, TREND_BRANDS, ConfigError, SearchConfig, resale_name
from .knowledge import LETTER_SIZES, TYPE_ALIASES, brand_key, normalize_sizes, resolve_type
from .notify import TelegramNotifier, money
from .scoring import TYPE_LABELS, normalize

log = logging.getLogger(__name__)

MAX_OFFERS_PER_DAY = 25  # Limit von Vinted

HELP = """<b>🤖 Vinted-Deal-Bot</b>

<b>💰 Resale (frisch &amp; weit unter Marktpreis)</b>
/marke <i>Name</i> – Marke beobachten, z. B.
   <code>/marke stone island</code>
   <code>/marke carhartt bis 80 rabatt 50 gewinn 20</code>
/trends – deine Trend-Marken anzeigen
/trends plus <i>Marke, Marke</i> – eigene Marken hinzufügen
/trends minus <i>Marke</i> – Marke entfernen
/trends an · /trends aus – alle Trend-Marken beobachten / stoppen
/stufe streng – nur die allergünstigsten (auch: normal, locker)

<b>🎯 Was gemeldet wird</b>
/groesse S M L – deine Größen (/groesse alle)
/ohne schuhe · /mit schuhe – Kategorien aus-/einblenden
/kategorien – alle Kategorien
/raritaeten an – nur seltene Stücke (vintage, 90er, Made in USA …)
/preis carhartt jacken 90 – eigenen Marktpreis beibringen
👍/👎 unter jeder Meldung – der Bot lernt deinen Geschmack (/vorlieben)
/probelauf – Testlauf mit Musterdaten

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
<code>günstiger 95</code> billiger als 95 % der vergleichbaren Angebote
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
    "min_cheaper_than": r"(?:günstiger|guenstiger|billiger)(?:\s*als)?\s*(\d+(?:[.,]\d+)?)\s*%?",
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
    return SearchConfig.resale_for_brand(_nice_brand(brand), source="telegram", **opts)


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
    if s.min_cheaper_than:
        bits.append(f"günstiger als {s.min_cheaper_than:g} %")
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


ADD_WORDS = {"plus", "add", "dazu", "hinzu", "hinzufügen", "hinzufuegen", "neu"}
REMOVE_WORDS = {"minus", "weg", "entfernen", "löschen", "loeschen", "remove", "raus"}


def _nice_brand(raw: str) -> str:
    """'jacquemus' -> 'Jacquemus'; eigene Schreibweise mit Großbuchstaben bleibt erhalten."""
    raw = " ".join(raw.split())[:40]
    builtin = next((b for b in TREND_BRANDS if normalize(b) == normalize(raw)), None)
    if builtin:
        return builtin
    return raw if any(c.isupper() for c in raw) else raw.title()


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
            "/stufe": self.cmd_level, "/filter": self.cmd_level,
            "/groesse": self.cmd_sizes, "/größe": self.cmd_sizes, "/groessen": self.cmd_sizes,
            "/größen": self.cmd_sizes, "/size": self.cmd_sizes,
            "/ohne": self.cmd_without, "/mit": self.cmd_with, "/kategorien": self.cmd_types,
            "/raritaeten": self.cmd_rare, "/raritäten": self.cmd_rare, "/rare": self.cmd_rare,
            "/vorlieben": self.cmd_prefs, "/preis": self.cmd_price, "/probelauf": self.cmd_sample,
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

    # -- Trend-Marken -------------------------------------------------------------

    def _watch(self, brand: str) -> bool:
        """Beobachtet eine Marke (Resale). True, wenn sie neu dazukam oder wieder eingeschaltet wurde."""
        name = resale_name(brand)
        existing = {s.name: s for s in self._numbered()}
        if name in existing:
            if self.storage.is_disabled(name):
                self.storage.set_disabled(name, False)
                return True
            return False
        self.storage.add_search(SearchConfig.resale_for_brand(brand, source="telegram"))
        return True

    def _unwatch(self, brand: str) -> bool:
        name = resale_name(brand)
        existing = {s.name: s for s in self._numbered()}
        if name not in existing:
            return False
        if existing[name].source == "telegram":
            self.storage.delete_search(name)
            self.storage.forget_search(name)
        else:  # steht in der config.yaml -> nur anhalten
            self.storage.set_disabled(name, True)
        return True

    def cmd_trends(self, arg: str) -> None:
        arg = arg.strip()
        if arg[:1] in "+-" and arg[1:].strip():  # "/trends +jacquemus" / "/trends -nike"
            action, rest = ("plus" if arg[0] == "+" else "minus"), arg[1:]
        else:
            action, _, rest = arg.partition(" ")
            action = action.lower()
        brands = [b.strip() for b in re.split(r"[,;\n]+", rest) if b.strip()]

        if action in ADD_WORDS:
            if not brands:
                self.reply("Welche Marke? z. B. <code>/trends plus jacquemus, ganni, miu miu</code>")
                return
            names = []
            for raw in brands:
                brand = self.monitor.add_trend_brand(_nice_brand(raw))
                self._watch(brand)
                names.append(brand)
            self.reply(f"✅ Zu deinen Trends hinzugefügt und beobachtet: <b>{html.escape(', '.join(names))}</b>\n\n"
                       + self._targets_text() + "\n\nDen Marktpreis lernt der Bot in den ersten Durchläufen.")
            return
        if action in REMOVE_WORDS:
            if not brands:
                self.reply("Welche Marke? z. B. <code>/trends minus nike</code>")
                return
            done, missing = [], []
            for raw in brands:
                brand = self.monitor.remove_trend_brand(raw)
                if brand:
                    self._unwatch(brand)
                    done.append(brand)
                else:
                    missing.append(raw)
            text = f"🗑 Aus deinen Trends entfernt: <b>{html.escape(', '.join(done))}</b>" if done else ""
            if missing:
                text += f"\nNicht in der Liste: {html.escape(', '.join(missing))}"
            self.reply(text.strip())
            return
        if action in ("an", "on", "start", "alle"):
            started = [b for b in self.monitor.trend_brands() if self._watch(b)]
            self.reply(f"✅ {len(self.monitor.trend_brands())} Trend-Marken werden beobachtet"
                       + (f" (neu: {html.escape(', '.join(started))})" if started else "")
                       + "\n\n" + self._targets_text())
            return
        if action in ("aus", "off", "stop"):
            stopped = [b for b in self.monitor.trend_brands() if self._unwatch(b)]
            self.reply(f"⏹ {len(stopped)} Trend-Marken werden nicht mehr beobachtet. "
                       "Die Liste bleibt gespeichert – /trends an startet sie wieder.")
            return

        existing = {s.name for s in self.monitor.active_searches()}
        own = {normalize(b) for b in self.storage.get_list("trends_added")}
        brands = self.monitor.trend_brands()
        lines = [f"<b>🔥 Deine Trend-Marken ({len(brands)})</b>"]
        for brand in brands:
            icon = "✅" if resale_name(brand) in existing else "▫️"
            star = " ⭐" if normalize(brand) in own else ""
            lines.append(f"{icon} {html.escape(brand)}{star}")
        lines.append("\n✅ = wird beobachtet · ⭐ = von dir hinzugefügt\n"
                     "<code>/trends plus jacquemus, ganni</code> – Marken hinzufügen\n"
                     "<code>/trends minus nike</code> – Marke entfernen\n"
                     "/trends an · /trends aus – alle beobachten / stoppen\n"
                     "/stufe – wie streng gefiltert wird")
        self.reply("\n".join(lines))

    # -- Schnäppchen-Stufe ----------------------------------------------------------

    def _targets_text(self) -> str:
        t = self.monitor.resale_targets()
        level = self.monitor.resale_level
        title = f"Stufe „{level}“" if level else "Einstellungen aus der config.yaml"
        return (f"🎯 <b>{title}</b> – gemeldet wird nur, was\n"
                f"⚡ höchstens {int(t['max_age_minutes'])} Min. online ist\n"
                f"💸 mind. {t['min_discount']:g} % unter Marktpreis liegt\n"
                f"🏆 günstiger als {t['min_cheaper_than']:g} % der vergleichbaren Angebote ist\n"
                f"💰 mind. {t['min_profit']:g} € Gewinn bringt\n"
                f"🏷 mind. Zustand „{html.escape(str(t['min_condition']))}“ hat")

    def cmd_level(self, arg: str) -> None:
        a = arg.strip().lower()
        if a in RESALE_LEVELS:
            self.storage.set_state("resale_level", a)
            self.reply("✅ Gespeichert.\n\n" + self._targets_text()
                       + ("\n\nStreng heißt: wenige Meldungen, aber nur echte Knaller." if a == "streng" else ""))
            return
        if a in ("config", "standard", "zurück", "zurueck", "reset"):
            self.storage.delete_state("resale_level")
            self.reply("✅ Es gelten wieder die Werte aus der config.yaml.\n\n" + self._targets_text())
            return
        options = []
        for name, t in RESALE_LEVELS.items():
            options.append(f"<code>/stufe {name}</code> – ≤ {t['max_age_minutes']} Min., ≥ {t['min_discount']:g} % "
                           f"unter Markt, günstiger als {t['min_cheaper_than']:g} %, ≥ {t['min_profit']:g} € Gewinn")
        self.reply(self._targets_text() + "\n\n<b>Stufen</b>\n" + "\n".join(options)
                   + "\n\nGilt für alle Resale-Suchen ohne eigene Werte.")

    def _add(self, search: SearchConfig) -> None:
        existing = {s.name for s in self._numbered()}
        base, n = search.name, 2
        while search.name in existing:
            search.name = f"{base} ({n})"
            n += 1
        self.storage.add_search(search)
        details = describe_search(self.monitor.effective(search))
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
            details = describe_search(self.monitor.effective(s))
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
            f"Schnäppchen-Stufe: {self.monitor.resale_level or 'aus config.yaml'}",
        ]
        if st["last_error"]:
            lines.append(f"Letzter Fehler: {html.escape(str(st['last_error'])[:200])}")
        self.reply("\n".join(lines))

    # -- Filter: Größe, Kategorien, Raritäten ----------------------------------------

    def cmd_sizes(self, arg: str) -> None:
        a = arg.strip().lower()
        if a in ("alle", "all", "egal", "*"):
            self.storage.set_json("filter_sizes", [])
            self.reply("✅ Alle Größen werden gemeldet.")
            return
        if a in ("standard", "reset", "config"):
            self.storage.delete_state("filter_sizes")
        elif a:
            sizes = normalize_sizes(re.split(r"[\s,;]+", arg))
            self.storage.set_json("filter_sizes", sizes)
        sizes = self.monitor.global_filters()["sizes"]
        now = ", ".join(sizes) if sizes else "alle"
        self.reply(f"📏 <b>Größen: {html.escape(now)}</b>\n"
                   "Gilt fürs Resale-Radar. Artikel ohne Größe (Taschen, Caps, One Size) kommen immer durch.\n\n"
                   "<code>/groesse S M L</code> · <code>/groesse M</code> · <code>/groesse M L 32</code> · "
                   "<code>/groesse alle</code>\n"
                   f"Buchstaben: {' '.join(LETTER_SIZES)} – Zahlen für Schuhe/Jeans möglich.")

    def _type_list(self, arg: str) -> tuple[list[str], list[str]]:
        found, unknown = [], []
        for word in re.split(r"[,;]+|\s+und\s+|\s+", arg.strip()):
            if not word:
                continue
            t = resolve_type(word)
            (found if t else unknown).append(t or word)
        return found, unknown

    def cmd_without(self, arg: str) -> None:
        types, unknown = self._type_list(arg)
        if not types:
            self.reply("Was soll raus? z. B. <code>/ohne schuhe, taschen</code> – /kategorien zeigt alle.")
            return
        hidden = self.monitor.global_filters()["exclude_types"]
        self.storage.set_json("filter_exclude_types", hidden + [t for t in types if t not in hidden])
        self._types_reply(unknown)

    def cmd_with(self, arg: str) -> None:
        types, unknown = self._type_list(arg)
        if not types:
            self.reply("Was soll wieder rein? z. B. <code>/mit schuhe</code> – /kategorien zeigt alle.")
            return
        hidden = self.monitor.global_filters()["exclude_types"]
        self.storage.set_json("filter_exclude_types", [t for t in hidden if t not in types])
        prefs = self.monitor.preferences()  # 👎-Zähler zurücksetzen, sonst wäre es gleich wieder weg
        for t in types:
            prefs.pop(f"type:{t}", None)
        self.storage.set_json("prefs", prefs)
        self._types_reply(unknown)

    def cmd_types(self, _arg: str = "") -> None:
        self._types_reply([])

    def _types_reply(self, unknown: list[str]) -> None:
        hidden = set(self.monitor.global_filters()["exclude_types"])
        lines = ["<b>🗂 Kategorien im Resale-Radar</b>"]
        for ptype in TYPE_ALIASES:
            lines.append(f"{'🚫' if ptype in hidden else '✅'} {TYPE_LABELS.get(ptype, ptype)}")
        lines.append("\n<code>/ohne schuhe, taschen</code> – ausblenden · <code>/mit schuhe</code> – wieder zeigen")
        if unknown:
            lines.append(f"Unbekannt: {html.escape(', '.join(unknown))}")
        self.reply("\n".join(lines))

    def cmd_rare(self, arg: str) -> None:
        a = arg.strip().lower()
        if a in ("an", "on", "nur", "ja"):
            self.storage.set_state("only_rare", "1")
        elif a in ("aus", "off", "nein"):
            self.storage.set_state("only_rare", "0")
        on = self.monitor.global_filters()["only_rare"]
        self.reply(("💎 <b>Nur Raritäten: an</b> – ich melde nur noch seltene Stücke "
                    "(vintage, 90er, Made in USA/Italy, Deadstock, begehrte Modelle wie Carhartt Detroit, "
                    "Stone Island Ghost, Arc'teryx Veilance …).\n/raritaeten aus – wieder alles")
                   if on else
                   ("💎 <b>Nur Raritäten: aus</b> – Raritäten werden markiert und höher bewertet, "
                    "normale Schnäppchen kommen aber auch.\n/raritaeten an – nur noch Raritäten"))

    def cmd_prefs(self, arg: str) -> None:
        if arg.strip().lower() in ("reset", "löschen", "loeschen", "zurücksetzen"):
            self.storage.set_json("prefs", {})
            self.reply("🧹 Vorlieben zurückgesetzt.")
            return
        prefs = {k: v for k, v in self.monitor.preferences().items() if v}
        if not prefs:
            self.reply("Noch keine Vorlieben gelernt. Tippe unter Meldungen auf 👍 oder 👎 – "
                       "dann lerne ich, was dir gefällt.")
            return
        lines = ["<b>🧠 Gelernte Vorlieben</b>"]
        for key, votes in sorted(prefs.items(), key=lambda kv: -kv[1]):
            kind, _, name = key.partition(":")
            label = TYPE_LABELS.get(name, name) if kind == "type" else name.title()
            lines.append(f"{'👍' if votes > 0 else '👎'} {html.escape(label)} ({votes:+d})")
        lines.append("\nAb 3× 👎 blende ich eine Kategorie aus. /vorlieben reset – alles vergessen")
        self.reply("\n".join(lines))

    def cmd_price(self, arg: str) -> None:
        """/preis carhartt jacken 90 – eigenen Marktpreis beibringen."""
        prices = self.storage.get_json("own_prices", {}) or {}
        m = re.match(r"^(.+?)\s+(\S+)\s+(\d+(?:[.,]\d+)?|weg|löschen|loeschen)\s*€?$", arg.strip(), re.IGNORECASE)
        if not m:
            lines = ["<b>💶 Deine Marktpreise</b>"] + [f"• {html.escape(k.replace('|', ' · '))}: {v:g} €"
                                                       for k, v in prices.items()]
            if len(lines) == 1:
                lines.append("noch keine")
            lines.append("\nBeibringen: <code>/preis carhartt jacken 90</code>\n"
                         "Entfernen: <code>/preis carhartt jacken weg</code>")
            self.reply("\n".join(lines))
            return
        brand, type_word, value = m.group(1), m.group(2), m.group(3)
        ptype = resolve_type(type_word)
        if not ptype:
            self.reply(f"Kategorie '{html.escape(type_word)}' kenne ich nicht. /kategorien zeigt alle.")
            return
        key = f"{brand_key(brand)}|{ptype}"
        if value.lower() in ("weg", "löschen", "loeschen"):
            prices.pop(key, None)
            self.storage.set_json("own_prices", prices)
            self.reply(f"🗑 Eigener Preis für {html.escape(brand)} {TYPE_LABELS.get(ptype, ptype)} entfernt.")
            return
        prices[key] = float(value.replace(",", "."))
        self.storage.set_json("own_prices", prices)
        self.reply(f"✅ Gemerkt: {html.escape(brand.title())} {TYPE_LABELS.get(ptype, ptype)} sind ca. "
                   f"<b>{prices[key]:g} €</b> wert. Danach rechne ich Rabatt und Gewinn.")

    def cmd_sample(self, _arg: str = "") -> None:
        from .sample_data import run_sample

        self.reply("🧪 Probelauf mit Musterdaten läuft …")
        result = run_sample(self.monitor.cfg, source_storage=self.storage)
        self.reply(result.summary_html())
        for alert in result.alerts[:3]:
            alert.demo = True
            alert.search_name = "🧪 PROBELAUF (Musterdaten – nicht echt)"
            self.tg.send_alert(alert)

    # -- Buttons -----------------------------------------------------------------

    def _answer(self, cb: dict, text: str = "") -> None:
        try:
            self.tg.api("answerCallbackQuery", callback_query_id=cb["id"], text=text[:190])
        except Exception as e:  # noqa: BLE001
            log.debug("answerCallbackQuery: %s", e)

    def handle_callback(self, cb: dict) -> None:
        data = cb.get("data") or ""
        kind, _, rest = data.partition(":")
        if kind == "fb":
            vote, _, item_id_s = rest.partition(":")
            try:
                text = self.monitor.record_feedback(int(item_id_s), vote == "1")
            except ValueError:
                text = "Ungültiger Button"
            self._answer(cb, text)
            if "ab jetzt aus" in text:
                self.reply(html.escape(text))
            return
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
