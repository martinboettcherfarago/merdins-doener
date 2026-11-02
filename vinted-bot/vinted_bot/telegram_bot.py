"""Telegram-Steuerung: Suchen per Chat verwalten und Angebote per Button senden."""

from __future__ import annotations

import html
import logging
import os
import re
import threading
import time
from datetime import date
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

from . import fakecheck
from .catalog import CATEGORIES, FAMILY_LABELS, TIER_LABELS, brand_info, resolve_type
from .config import RESALE_LEVELS, TREND_WATCHES, ConfigError, SearchConfig, is_brand_entry, watch_name
from .knowledge import (LETTER_SIZES, brand_key, estimate_item, normalize_sizes, rarity,
                        trend_match)
from .models import Item
from .monitor import AUTO_BAND
from .notify import TelegramNotifier, money
from .scoring import TYPE_LABELS, normalize

log = logging.getLogger(__name__)

MAX_OFFERS_PER_DAY = 25  # Limit von Vinted

HELP = """<b>🤖 Vinted-Deal-Bot</b> – frisch hochgeladene Teile weit unter Wert

<b>💰 Schnäppchen-Radar</b>
/stufe auto – 3–10 wirklich gute Treffer pro Stunde (auch: normal · streng · locker)
/budget 30 – höchstens 30 € pro Teil · <code>/budget marken 80</code> für teure Marken
/radar an|aus – ⚡ Sniper: neueste Uploads alle ~4 s · <code>/radar an &lt;Vinted-Link&gt;</code>
/trends – deine Marken &amp; Trends · <code>/trends plus jacquemus</code> · <code>/trends minus nike</code>
/marke <i>Name</i> – mit eigenen Regeln, z. B. <code>/marke carhartt bis 60 rabatt 50</code>
/wert <i>Artikel oder Link</i> – Wert schätzen, z. B. <code>/wert carhartt detroit jacke 40 €</code>

<b>🎯 Was gemeldet wird</b>
/groesse S M L · /groesse alle – deine Größen
/ohne schuhe · /mit schuhe · /kategorien – Kategorien
/raritaeten an – nur Raritäten · /preis carhartt jacken 90 – eigener Marktwert
👍/👎 unter jeder Meldung – lernt deinen Geschmack (/vorlieben)

<b>👗 Bildmodell &amp; Echtheit</b>
/modell · /modell an|aus · /sammeln · /trainieren – Bildmodell (Standard: aus)
/ampel streng|warnen|aus – 🛡 Fake-Ampel · /fake &lt;Link&gt; · /echt &lt;Link&gt;
/ki an|aus · /pruefen &lt;Link&gt; – Claude-Bildcheck

<b>⚙️ Sonstiges</b>
/neu <i>Begriff</i> – eigene Suche, z. B. <code>/neu nike air max 90 bis 40 score 60</code>
/suchen · /pause <i>Nr</i> · /weiter <i>Nr</i> · /loeschen <i>Nr</i>
/pause · /weiter – alle Meldungen anhalten/fortsetzen
/push sniper|alle|aus – 🔔 Push-Ton nur für ⚡ Sniper-Treffer (Standard)
/status · /live – was kam wirklich rein (Takt, Alter, Preise)? · /probelauf

<i>Optionen für /neu und /marke:</i> <code>bis 40</code> · <code>ab 10</code> · <code>rabatt 40</code> · <code>gewinn 15</code> · <code>frisch 10</code> · <code>günstiger 95</code> · <code>score 60</code> · <code>markt 50</code>"""

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
    """'jacquemus' -> 'Jacquemus', 'stone island' -> 'Stone Island', 'vintage lederjacke' -> 'Vintage Lederjacke'."""
    raw = " ".join(raw.split())[:50]
    builtin = next((b for b in TREND_WATCHES if normalize(b) == normalize(raw)), None)
    if builtin:
        return builtin
    if is_brand_entry(raw):
        info = brand_info(raw)
        if info and normalize(info[0]) == normalize(raw):
            return info[0]
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
            "/wert": self.cmd_value, "/schaetzen": self.cmd_value, "/schätzen": self.cmd_value,
            "/radar": self.cmd_radar, "/sniper": self.cmd_radar, "/budget": self.cmd_budget,
            "/ki": self.cmd_ai, "/ai": self.cmd_ai, "/pruefen": self.cmd_check, "/prüfen": self.cmd_check,
            "/check": self.cmd_check,
            "/modell": self.cmd_model, "/model": self.cmd_model, "/trainieren": self.cmd_train,
            "/sammeln": self.cmd_collect, "/fake": self.cmd_mark_fake, "/echt": self.cmd_mark_real,
            "/ampel": self.cmd_ampel, "/push": self.cmd_push, "/ton": self.cmd_push,
            "/suchen": self.cmd_list, "/liste": self.cmd_list, "/list": self.cmd_list,
            "/loeschen": self.cmd_delete, "/löschen": self.cmd_delete, "/delete": self.cmd_delete,
            "/pause": self.cmd_pause, "/weiter": self.cmd_resume, "/resume": self.cmd_resume,
            "/status": self.cmd_status, "/live": self.cmd_live, "/statistik": self.cmd_live,
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
        """Beobachtet eine Marke/einen Trend. True, wenn sie neu dazukam oder wieder eingeschaltet wurde."""
        name = watch_name(brand)
        existing = {s.name: s for s in self._numbered()}
        if name in existing:
            if self.storage.is_disabled(name):
                self.storage.set_disabled(name, False)
                return True
            return False
        self.storage.add_search(SearchConfig.watch(brand, source="telegram"))
        return True

    def _unwatch(self, brand: str) -> bool:
        name = watch_name(brand)
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
                elif self._unwatch(_nice_brand(raw)):  # z. B. Marke aus der config.yaml
                    done.append(_nice_brand(raw))
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
        entries = self.monitor.trend_brands()
        lines = [f"<b>🔥 Deine Trend-Liste ({len(entries)})</b>"]
        for title, items in (("Marken", [e for e in entries if is_brand_entry(e)]),
                             ("Modelle & Styles", [e for e in entries if not is_brand_entry(e)])):
            if items:
                lines.append(f"\n<b>{html.escape(title)}</b>")
            for entry in items:
                icon = "✅" if watch_name(entry) in existing else "▫️"
                star = " ⭐" if normalize(entry) in own else ""
                lines.append(f"{icon} {html.escape(entry)}{star}")
        lines.append("\n✅ = wird beobachtet · ⭐ = von dir hinzugefügt\n"
                     "<code>/trends plus jacquemus, vintage lederjacke</code> – Marken oder Suchbegriffe\n"
                     "<code>/trends minus nike</code> – entfernen\n"
                     "/trends an · /trends aus – alle beobachten / stoppen\n"
                     "/stufe – wie streng gefiltert wird")
        self.reply("\n".join(lines))

    # -- Schnäppchen-Stufe ----------------------------------------------------------

    def _targets_text(self) -> str:
        t = self.monitor.resale_targets()
        level = self.monitor.resale_level
        title = (f"Stufe „auto“ – gerade „{self.monitor.auto_level()}“" if self.monitor.auto_active()
                 else f"Stufe „{level}“" if level else "Einstellungen aus der config.yaml")
        return (f"🎯 <b>{title}</b> – gemeldet wird nur, was\n"
                f"⚡ höchstens {int(t['max_age_minutes'])} Min. online ist\n"
                f"💸 mind. {t['min_discount']:g} % unter Marktpreis liegt\n"
                f"🏆 günstiger als {t['min_cheaper_than']:g} % der vergleichbaren Angebote ist\n"
                f"💰 mind. {t['min_profit']:g} € Gewinn bringt (bei billigen Markenteilen reicht die Hälfte des "
                f"Preises)\n"
                f"🏷 mind. Zustand „{html.escape(str(t['min_condition']))}“ hat")

    def cmd_level(self, arg: str) -> None:
        a = arg.strip().lower()
        if a == "auto":
            self.storage.set_state("resale_level", "auto")
            low, high = AUTO_BAND
            self.reply(f"✅ <b>Auto-Stufe an</b> – kommen weniger als {low:g} Schnäppchen pro Stunde, lockere ich; "
                       f"kommen mehr als {high:g}, werde ich strenger (zwischen „normal“ und „streng“, höchstens alle "
                       "15 Min. – nie lockerer als „normal“).\n\n" + self._targets_text())
            return
        if a in RESALE_LEVELS:
            self.storage.set_state("resale_level", a)
            self.reply("✅ Gespeichert.\n\n" + self._targets_text()
                       + ("\n\nStreng heißt: wenige Meldungen, aber nur echte Knaller." if a == "streng" else ""))
            return
        if a in ("config", "standard", "zurück", "zurueck", "reset"):
            self.storage.delete_state("resale_level")
            self.reply("✅ Es gelten wieder die Werte aus der config.yaml.\n\n" + self._targets_text())
            return
        options = [f"<code>/stufe auto</code> – passt sich an: hält {AUTO_BAND[0]:g}–{AUTO_BAND[1]:g} Schnäppchen pro "
                   "Stunde (empfohlen)"]
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
            f"Schnäppchen-Stufe: {self.monitor.level_label()}",
            "Budget: bis {:g} € · teure Marken bis {:g} €".format(*self.monitor.budget()),
            f"⚡ Sniper: {'an, alle ' + format(self.monitor.cfg.sniper_every_seconds, 'g') + ' s' if self.monitor.sniper_enabled() else 'aus'}",
        ]
        tempo = [(n, t) for n, t in self.monitor.scheduler.tempo() if n != "⚡ Sniper"]
        if tempo:
            lines.append("⏱ Takt: " + " · ".join(f"{html.escape(n.split(' · ', 1)[-1])} alle {t:.0f} s"
                                                 for n, t in tempo[:5])
                         + f" … ruhigste alle {tempo[-1][1]:.0f} s")
        workers = st.get("workers") or {}
        if workers:
            lines.append("Sucher: " + " · ".join(f"{k}: {v['cycles']} Runden, {v['checked']} Artikel, "
                                                 f"{v['alerts']} Meldungen" for k, v in sorted(workers.items())))
        r = self.monitor.reviewer
        if r is not None:
            lines.append(f"KI-Bildcheck: {'an' if r.enabled else 'aus'} · {st.get('ai_checked', 0)} geprüft · "
                         f"{st.get('ai_fakes', 0)} Fakes raus · {st.get('ai_finds', 0)} KI-Funde")
        if st["last_error"]:
            lines.append(f"Letzter Fehler: {html.escape(str(st['last_error'])[:200])}")
        self.reply("\n".join(lines))

    def cmd_live(self, arg: str = "") -> None:
        """/live – was kam in der letzten Stunde wirklich rein? /live 10 = letzte 10 Minuten."""
        minutes = float(arg) if arg.strip().replace(".", "", 1).isdigit() else 60.0
        self.reply(self.monitor.live.text(max(1.0, min(minutes, 24 * 60)), level=self.monitor.level_label()))

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
                   "Gilt fürs Schnäppchen-Radar. Artikel ohne Größe (Taschen, Caps, One Size) kommen immer durch.\n\n"
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
        # "/mit schuhe" holt auch einzeln ausgeblendete Sneaker/Stiefel zurück
        types = types + [k for k, c in CATEGORIES.items() if c.family in types]
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
        lines = ["<b>🗂 Kategorien im Schnäppchen-Radar</b>"]
        for fam, label in FAMILY_LABELS.items():
            members = [c for c in CATEGORIES.values() if c.family == fam]
            off = fam in hidden
            partly = [c.label for c in members if c.key in hidden]
            icon = "🚫" if off else ("◐" if partly else "✅")
            detail = ", ".join(c.label for c in members) if len(members) > 1 else ""
            extra = f" – aus: {', '.join(partly)}" if partly and not off else ""
            lines.append(f"{icon} <b>{html.escape(label)}</b>" + (f" ({html.escape(detail)})" if detail else "")
                         + html.escape(extra))
        lines.append("\n<code>/ohne schuhe, taschen</code> – ausblenden · <code>/mit schuhe</code> – wieder zeigen\n"
                     "Auch einzeln: <code>/ohne sandalen</code> · <code>/mit sneaker</code>")
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

    def cmd_value(self, arg: str) -> None:
        """/wert carhartt detroit jacke vintage · /wert <Vinted-Link> – ungefähren Wert schätzen."""
        text = arg.strip()
        m = re.search(r"/items/\d+-([a-z0-9-]+)", text)
        if m:  # Titel steckt im Link: /items/123-carhartt-detroit-jacket
            text = m.group(1).replace("-", " ")
        if not text:
            self.reply("Was soll ich schätzen? z. B. <code>/wert carhartt detroit jacke vintage gut</code>\n"
                       "oder einen Vinted-Link einfügen.")
            return
        cond = next((c for c in ("neu mit etikett", "neu ohne etikett", "sehr gut", "zufriedenstellend", "gut")
                     if c in text.lower()), "")
        price_m = re.search(r"(\d+(?:[.,]\d+)?)\s*€", text)
        item = Item(id=0, title=text, price=float(price_m.group(1).replace(",", ".")) if price_m else 0.0,
                    condition=cond)
        est = estimate_item(item)
        rare, trend = rarity(item), trend_match(text)
        own_prices = self.storage.get_json("own_prices", {}) or {}
        value, notes = est.value, []
        own = own_prices.get(f"{brand_key(est.brand)}|{est.ptype}") if est.brand else None
        learned = self.storage.group_history(f"b:{brand_key(est.brand) or 'ohne'}|{est.ptype}")
        if own:
            value = own * est.factor
            notes.append("dein eigener Marktpreis (/preis)")
        elif len(learned) >= 5:
            from statistics import median
            n = len(learned)
            value = ((n * median(learned) + 5 * est.base) / (n + 5) if n < 30 else median(learned)) * est.factor
            notes.append(f"{n} echte Vergleichspreise eingerechnet")
        if rare.level:
            value *= rare.premium
            notes.append(f"💎 Rarität ({' · '.join(rare.tags)}) +{rare.premium - 1:.0%}")
        elif trend:
            value *= 1.1
            notes.append(f"🔥 Trend ({trend}) +10%")
        tier = TIER_LABELS.get(est.tier or "", "unbekannt")
        lines = [f"<b>💶 Geschätzter Wert: ca. {money(value)}</b>",
                 f"Spanne: {money(value * est.low / est.value)} – {money(value * est.high / est.value)}",
                 "",
                 f"🏷 Marke: {html.escape(est.brand or 'nicht erkannt')} ({tier})",
                 f"🗂 Kategorie: {TYPE_LABELS.get(est.ptype, est.ptype)}",
                 f"📐 Grundlage: {html.escape(est.basis)}"
                 + (f" · {html.escape(', '.join(est.factor_notes))}" if est.factor_notes else "")]
        lines += [f"➕ {html.escape(n)}" for n in notes]
        lines.append(f"🎯 Sicherheit: {'hoch' if own or len(learned) >= 15 else est.confidence}")
        if price_m and item.price:
            disc = 1 - item.price / value
            lines.append(f"\nFür {money(item.price)}: " + (f"<b>{disc:.0%} unter Wert</b> 👍" if disc > 0
                                                         else f"{-disc:.0%} über Wert"))
            ampel = fakecheck.check(item, est.brand or "", est.ptype, max(0.0, disc), est.tier)
            if ampel.visible or ampel.level != "grün":
                lines.append(html.escape(ampel.line()))
        lines.append("\nWeiß du es besser? <code>/preis marke kategorie betrag</code>")
        self.reply("\n".join(lines))

    # -- KI-Bildcheck ------------------------------------------------------------------

    def cmd_ai(self, arg: str) -> None:
        r = self.monitor.reviewer
        if r is None:
            self.reply("🤖 Der KI-Bildcheck ist nicht verfügbar (Paket 'anthropic' fehlt – start.bat neu ausführen).")
            return
        a = arg.strip().lower()
        if a in ("an", "on", "start"):
            if not (self.monitor.cfg.ai_api_key or os.environ.get("ANTHROPIC_API_KEY")):
                self.reply("🔑 Für den KI-Bildcheck brauche ich einen Anthropic-API-Schlüssel.\n"
                           "Trag ihn in der config.yaml unter <code>ai → api_key</code> ein und starte den Bot neu. "
                           "Schlüssel gibt es auf console.anthropic.com.")
                return
            self.storage.set_state("ai_enabled", "1")
            self.storage.delete_state("ai_disabled_reason")
        elif a in ("aus", "off", "stop"):
            self.storage.set_state("ai_enabled", "0")
        cfg = self.monitor.cfg
        st = self.monitor.stats
        reason = self.storage.get_state("ai_disabled_reason")
        lines = [f"🤖 <b>KI-Bildcheck: {'an' if r.enabled else 'aus'}</b>"
                 + (f" – {html.escape(reason)}" if reason else ""),
                 f"Modell: {html.escape(cfg.ai_model)} · Gründlichkeit: {html.escape(cfg.ai_effort)}",
                 f"Heute: {r.used_today('checks')}/{cfg.ai_max_checks_per_day} Checks, "
                 f"{r.used_today('second_looks')}/{cfg.ai_max_second_looks_per_day} Zweitblicke · "
                 f"Kosten ca. {r.cost_today():.2f} $",
                 f"Seit Start: {st['ai_checked']} geprüft · {st['ai_fakes']} Fakes aussortiert · "
                 f"{st['ai_finds']} KI-Funde",
                 "",
                 "Für jeden Treffer prüft die KI die Fotos: Echtheit, Zustand, Look, Trend, realistischer Wert, "
                 "Urteil (kaufen/vielleicht/lassen). Bei Fake-Verdacht wird nicht gemeldet. Knapp verpasste "
                 "Retro-/Trend-Teile schaut sie sich zusätzlich an (🤖✨ KI-Fund). Deine 👍/👎 bringen ihr "
                 "deinen Geschmack bei.",
                 "",
                 "<code>/ki an</code> · <code>/ki aus</code> · <code>/pruefen &lt;Vinted-Link&gt;</code>"]
        if r.last_error:
            lines.insert(4, f"Letzter Fehler: {html.escape(r.last_error)}")
        self.reply("\n".join(lines))

    def cmd_check(self, arg: str) -> None:
        """/pruefen <Vinted-Link> – einen beliebigen Artikel von der KI prüfen lassen."""
        from .vision import listing_context
        r = self.monitor.reviewer
        m = re.search(r"/items/(\d+)(?:-([a-z0-9-]+))?", arg)
        if not m:
            self.reply("Schick mir einen Vinted-Link: <code>/pruefen https://www.vinted.de/items/123-…</code>")
            return
        if r is None or not r.enabled:
            self.reply("🤖 Der KI-Bildcheck ist aus – erst <code>/ki an</code>.")
            return
        item_id = int(m.group(1))
        title = (m.group(2) or "").replace("-", " ") or f"Artikel {item_id}"
        price_m = re.search(r"(\d+(?:[.,]\d+)?)\s*€", arg)
        item = Item(id=item_id, title=title, price=float(price_m.group(1).replace(",", ".")) if price_m else 0.0,
                    url=f"{self.monitor.cfg.web_base}/items/{item_id}")
        self.reply("🤖 Ich schaue mir die Fotos an …")
        verdict = r.review(item, listing_context(item) + "\n(Preis unbekannt, falls 0)")
        if verdict is None:
            self.reply("⚠️ Prüfung nicht möglich" + (f": {html.escape(r.last_error)}" if r.last_error else
                                                    " (keine Fotos gefunden oder Tageslimit erreicht)."))
            return
        self.reply("\n".join(html.escape(line) for line in verdict.lines())
                   + "\n\n<i>Hinweis: Eine KI kann Echtheit nur anhand sichtbarer Merkmale einschätzen – "
                   "bei teuren Teilen lieber Fotos von Etiketten anfordern.</i>")

    # -- Eigenes Modell -----------------------------------------------------------------

    def _brain_or_hint(self) -> Any:
        b = self.monitor.brain
        if b is None and self.storage.get_state("ml") == "aus":
            self.reply("🧠 Das Bildmodell ist <b>aus</b> – der Bot sucht nur mit seinen Regeln (schneller, weniger "
                       "Rechenleistung). Einschalten: <code>/modell an</code>")
            return None
        if b is None or not b.embedder.installed():
            self.reply("🧠 Das eigene Modell ist noch nicht installiert.\n"
                       "Windows: Bot stoppen, <b>ki-installieren.bat</b> doppelklicken (einmalig ca. 300 MB), "
                       "dann start.bat. Mac/Linux: <code>./ki-installieren.sh</code>.")
            return None
        if b.embedder.error:
            self.reply(f"🧠 Das eigene Modell hat ein Problem: {html.escape(b.embedder.error)}")
            return None
        return b

    def cmd_model(self, arg: str = "") -> None:
        a = arg.strip().lower()
        if a in ("aus", "off", "stop"):
            self.storage.set_state("ml", "aus")
            if self.monitor.brain is not None:
                self.monitor.brain.stop()
                self.monitor.brain = None
            self.reply("🧠 Bildmodell <b>aus</b> – ab sofort entscheidet der Bot nur nach Marke, Preis, Zustand und "
                       "Titel. Das spart Rechenleistung, die Sucher sind schneller. Bleibt auch nach einem Neustart "
                       "aus. Wieder an: <code>/modell an</code>")
            return
        if a in ("an", "on", "start"):
            self.storage.set_state("ml", "an")
            self.reply("🧠 Bildmodell <b>an</b> – es wird beim nächsten Start geladen (Bot mit Strg + C stoppen, "
                       "start.bat neu starten). Braucht einmalig ki-installieren.bat.")
            return
        b = self._brain_or_hint()
        if b is None:
            return
        st = b.status()
        last = st["last_train"]
        when = (f"vor {int((time.time() - last) // 3600)} Std." if last else "noch nie")
        lines = [f"🧠 <b>Eigenes Modell</b> {'(' + st['busy'] + ' …)' if st['busy'] else ''}"]
        if st.get("backbone"):
            lines.append(f"🖼 Bildmodell: {html.escape(st['backbone'])} · erkennt {st['tags']} Tags")
        if st.get("fallback"):
            lines.append(f"⚠️ {html.escape(st['fallback'])} – ki-installieren.bat erneut ausführen")
        lines += [f"📸 Datensatz: <b>{st['samples']:,} Bilder</b>".replace(",", ".")
                 + f" (heute {st['today']}, in Arbeit {st['queue']})",
                 f"🏋️ Zuletzt trainiert: {when} (automatisch alle {self.monitor.cfg.ml_train_every_hours:g} Std.)"]
        if st["value_mape"] is not None:
            lines.append(f"💶 Wert-Modell: Ø {st['value_mape']:.0%} Abweichung"
                         + (f" (Faustregel {st['heur_mape']:.0%})" if st["heur_mape"] is not None else "")
                         + (" – wird genutzt ✅" if st["value_trusted"] else " – lernt noch"))
        if st["pop_auc"] is not None:
            lines.append(f"🔥 Begehrt-Modell: Trefferqualität {st['pop_auc']:.0%}")
        lines.append(f"❤️ Geschmack: {st['likes']} Bewertungen"
                     + (f" · Trefferqualität {st['taste_auc']:.0%}" if st["taste_auc"] else ""))
        lines.append(f"🔍 Fake-Modell: {st['fakes']} Beispiele"
                     + (f" · Trefferqualität {st['fake_auc']:.0%}" if st["fake_auc"] else " (lernt noch)"))
        lines.append(f"🛡 Fake-Ampel: {html.escape(self.monitor.ampel_mode())} (sofort aktiv: Marke × Preis × "
                     "Verräter-Wörter × Foto) – /ampel")
        lines.append("\n<code>/sammeln</code> – Tausende Bilder auf einmal sammeln und trainieren\n"
                     "<code>/trainieren</code> – jetzt neu trainieren\n"
                     "<code>/fake &lt;Link&gt;</code> · <code>/echt &lt;Link&gt;</code> – dem Fake-Modell etwas beibringen")
        self.reply("\n".join(lines))

    def cmd_train(self, _arg: str = "") -> None:
        b = self._brain_or_hint()
        if b is None:
            return
        b.request_training()
        self.reply("🏋️ Training gestartet – das Ergebnis schicke ich dir gleich.")

    def cmd_collect(self, arg: str) -> None:
        b = self._brain_or_hint()
        if b is None:
            return
        pages = int(arg) if arg.strip().isdigit() else 3
        pages = max(1, min(10, pages))
        n = len([s for s in self.monitor.active_searches() if s.is_resale])
        self.reply(f"🧲 Sammel-Turbo gestartet: {n} Suchen × bis zu {pages} Seiten à 96 Artikel "
                   f"(bis zu {n * pages * 96:,} Bilder). Die normale Suche läuft weiter. ".replace(",", ".")
                   + "Danach wird automatisch trainiert – ich melde mich.")
        threading.Thread(target=self.monitor.bootstrap, kwargs={"pages": pages, "done": self.reply},
                         name="KI-Sammeln", daemon=True).start()

    def _label(self, arg: str, fake: bool) -> None:
        b = self._brain_or_hint()
        if b is None:
            return
        m = re.search(r"/items/(\d+)", arg)
        if not m:
            self.reply(f"Schick mir einen Vinted-Link: <code>/{'fake' if fake else 'echt'} https://www.vinted.de/items/…</code>")
            return
        if b.label_fake(int(m.group(1)), fake):
            self.reply(f"✅ Gemerkt: {'Fake' if fake else 'echt'}. Das Fake-Modell lernt beim nächsten Training daraus.")
        else:
            self.reply("Diesen Artikel hat der Bot noch nicht gesehen – ich kann nur Artikel aus dem Datensatz markieren.")

    def cmd_ampel(self, arg: str) -> None:
        """/ampel streng|warnen|aus – wie die Fake-Ampel mit verdächtigen Treffern umgeht."""
        a = arg.strip().lower()
        if a in fakecheck.MODES:
            self.storage.set_state("fake_ampel", a)
        mode = self.monitor.ampel_mode()
        explain = {"streng": "🔴 rot = nicht melden (mit KI-Bildcheck: nur melden, wenn Claude die Fotos für echt hält)"
                             ", 🟡 gelb = mit Warnung melden",
                   "warnen": "🔴/🟡 werden mit Warnung gemeldet – du entscheidest selbst",
                   "aus": "keine Fake-Ampel (nur die alte Regel: Luxus ≥ 85 % unter Wert = aussortieren)"}[mode]
        self.reply(f"🛡 <b>Fake-Ampel: {mode}</b>\n{explain}\n\n"
                   "Sie prüft sofort jeden Treffer: oft gefälschte Marke × viel zu billig, Verräter-Wörter "
                   "(„1:1“, „AAA“, „UA“, „mirror“, „wie original“, „alle Größen da“ …), „neu mit Etikett“ zum "
                   "Spottpreis, Katalogfoto statt eigenem Foto und – sobald trainiert – dein eigenes Fake-Modell.\n"
                   "<i>Grün heißt „keine Warnzeichen“, nicht „garantiert echt“.</i>\n\n"
                   "<code>/ampel streng</code> · <code>/ampel warnen</code> · <code>/ampel aus</code>")

    def cmd_push(self, arg: str) -> None:
        """/push sniper|alle|aus – welche Meldungen mit Push-Ton kommen."""
        a = arg.strip().lower()
        if a in ("sniper", "alle", "aus"):
            self.storage.set_state("push", a)
        mode = self.monitor.push_mode()
        what = {"sniper": "nur <b>⚡ Sniper-Treffer</b> (frisch hochgeladen, meist erst Sekunden alt)",
                "alle": "<b>alle</b> Meldungen", "aus": "<b>keine</b> Meldung – alles kommt lautlos"}[mode]
        self.reply(f"🔔 <b>Push-Ton: {mode}</b>\nMit Ton und Push kommt {what}. Alles andere landet trotzdem im "
                   "Chat, nur lautlos.\n\n<code>/push sniper</code> · <code>/push alle</code> · <code>/push aus</code>")

    def cmd_mark_fake(self, arg: str) -> None:
        self._label(arg, True)

    def cmd_mark_real(self, arg: str) -> None:
        self._label(arg, False)

    def cmd_radar(self, arg: str) -> None:
        """⚡ Sniper: neueste Uploads auf ganz Vinted alle paar Sekunden (optional nur für einen Vinted-Link)."""
        a = arg.strip()
        if a.lower().startswith(("an", "on", "start")):
            link = re.search(r"https?://\S*vinted\.\S+", a)
            self.storage.set_state("sniper", "1")
            if link:
                self.storage.set_state("sniper_url", link.group(0))
            elif self.storage.get_state("sniper_url"):
                self.storage.delete_state("sniper_url")
        elif a.lower().startswith(("aus", "off", "stop")):
            self.storage.set_state("sniper", "0")
            self.reply("⚡ Sniper aus. Die normalen Marken- und Trend-Suchen laufen weiter. <code>/radar an</code>")
            return
        m = self.monitor
        normal, _brands = m.budget()
        on = m.sniper_enabled()
        where = "in deiner Kategorie (Link)" if self.storage.get_state("sniper_url") else "auf ganz Vinted"
        self.reply(f"⚡ <b>Sniper: {'an' if on else 'aus'}</b>\n"
                   f"Alle ~{m.cfg.sniper_every_seconds:g} s schaue ich mir die neuesten Uploads {where} bis "
                   f"{normal:g} € an – die Treffer sind meist erst Sekunden alt. Ist sehr viel los, blättere ich "
                   "sofort weiter, damit nichts durchrutscht. Gemeldet werden nur Marken aus deiner Trend-Liste, "
                   "Premium-Marken und Raritäten weit unter Wert (deine Größen, Kategorien, /stufe und /budget "
                   "gelten).\n"
                   "Deine Marken-Suchen laufen daneben im eigenen Takt: Marken mit vielen Uploads alle ~10–25 s, "
                   "ruhige alle 1–2 Min. (/status zeigt den Takt).\n\n"
                   "<code>/radar an</code> · <code>/radar aus</code> · "
                   "<code>/radar an &lt;Vinted-Kategorie-Link&gt;</code> (z. B. nur Herren-Jacken)")

    def cmd_budget(self, arg: str) -> None:
        """/budget 30 · /budget marken 80 – wie viel ein gemeldetes Schnäppchen höchstens kosten darf."""
        a = arg.strip().lower().replace("€", "")
        nums = re.findall(r"\d+(?:[.,]\d+)?", a)
        if nums:
            value = max(1.0, float(nums[0].replace(",", ".")))
            if a.startswith(("marke", "teuer", "brand", "luxus")):
                self.storage.set_state("budget_brands", f"{value:g}")
            else:
                self.storage.set_state("budget", f"{value:g}")
                if len(nums) > 1:
                    self.storage.set_state("budget_brands", f"{max(1.0, float(nums[1].replace(',', '.'))):g}")
        normal, brands = self.monitor.budget()
        self.reply(f"💶 <b>Budget: bis {normal:g} € pro Teil</b>\n"
                   f"Ausnahme für teure Marken (Luxus, Designer, Outdoor-Premium wie Stone Island, Arc'teryx, "
                   f"Moncler): bis {brands:g} €.\n"
                   "Gilt für das Schnäppchen-Radar und den ⚡ Sniper – deine eigenen Suchen behalten ihre Grenzen.\n\n"
                   "<code>/budget 25</code> · <code>/budget marken 100</code> · <code>/budget 30 80</code>")

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
