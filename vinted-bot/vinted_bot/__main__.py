"""Startpunkt: python -m vinted_bot [run|scan|test-notify|chat-id]"""

from __future__ import annotations

import argparse
import logging
import os
import signal
import threading
import sys
import time
import warnings
from typing import Any, Optional

from . import __version__
from .config import Config, ConfigError, load_config
from .models import Item
from .notify import Alert, DiscordNotifier, MultiNotifier, NtfyNotifier, TelegramNotifier, money
from .scoring import score_item, suggest_offers
from .storage import Storage
from .vinted import VintedClient, VintedError, query_for_search

log = logging.getLogger("vinted_bot")


def build_notifiers(cfg: Config, offers_via_bot: bool) -> tuple[MultiNotifier, Optional[TelegramNotifier]]:
    channels: list[Any] = []
    telegram = None
    if cfg.telegram_token and cfg.telegram_chat_id:
        telegram = TelegramNotifier(cfg.telegram_token, cfg.telegram_chat_id, offers_via_bot=offers_via_bot)
        channels.append(telegram)
    if cfg.discord_webhook:
        channels.append(DiscordNotifier(cfg.discord_webhook))
    if cfg.ntfy_topic:
        channels.append(NtfyNotifier(cfg.ntfy_server, cfg.ntfy_topic))
    return MultiNotifier(channels), telegram


def build_account(cfg: Config) -> Any:
    if not cfg.account_enabled:
        return None
    from .account import VintedAccount

    try:
        return VintedAccount(cfg.domain, cfg.account_cookies, proxy=cfg.proxy)
    except (ValueError, RuntimeError) as e:
        log.warning("Angebote per Bot deaktiviert: %s", e)
        return None


# -- Befehle ------------------------------------------------------------------------

def cmd_run(cfg: Config) -> int:
    from .monitor import Monitor
    from .telegram_bot import TelegramController

    account = build_account(cfg)
    notifier, telegram = build_notifiers(cfg, offers_via_bot=account is not None)
    if not notifier and not cfg.telegram_token:
        log.error("Kein Benachrichtigungs-Kanal eingerichtet (Telegram, Discord oder ntfy) – siehe README.")
        return 2
    storage = Storage(cfg.database)
    monitor = Monitor(cfg, VintedClient(cfg.domain, proxy=cfg.proxy), storage, notifier)
    monitor.reviewer = build_reviewer(cfg, storage, monitor)
    monitor.brain = build_brain(cfg, notifier)

    controller = None
    if cfg.telegram_token:
        tg = telegram or TelegramNotifier(cfg.telegram_token, "")
        controller = TelegramController(tg, monitor, account)
        controller.start()
        if not cfg.telegram_chat_id:
            log.warning("Telegram: noch keine chat_id. Schreib deinem Bot /start – er antwortet mit deiner Chat-ID.")
            if not notifier:
                log.info("Warte auf /start im Telegram-Chat … (Strg+C zum Beenden)")
                _wait_forever(controller)
                return 0

    if not monitor.all_searches():
        log.warning("Noch keine Suchen – in der config.yaml eintragen oder per Telegram: /neu nike air max bis 40")

    def _shutdown(*_a: Any) -> None:
        log.info("Beende …")
        monitor.stop()
        if controller:
            controller.stop()

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    active = monitor.active_searches()
    resale_brands = [s.keywords or s.name for s in active if s.is_resale]
    names = ", ".join(s.name for s in active if not s.is_resale) or "–"
    if resale_brands:
        names += f"\n💰 Schnäppchen-Radar: {len(resale_brands)} Marken & Trends ({', '.join(resale_brands[:6])}" \
                 + (" …)" if len(resale_brands) > 6 else ")") \
                 + f"\n🎯 Schnäppchen-Stufe: {monitor.level_label()} (/stufe)"
        f = monitor.global_filters()
        names += (f"\n📏 Größen: {', '.join(f['sizes']) or 'alle'} (/groesse)"
                  f" · 🚫 ausgeblendet: {', '.join(f['exclude_types']) or 'nichts'} (/kategorien)"
                  + (" · 💎 nur Raritäten" if f["only_rare"] else ""))
    normal, brands = monitor.budget()
    names += f"\n💶 Budget: bis {normal:g} € · teure Marken bis {brands:g} € (/budget)"
    if monitor.sniper_enabled():
        names += (f"\n⚡ Sniper: alle ~{cfg.sniper_every_seconds:g} s die neuesten Uploads auf ganz Vinted bis "
                  f"{normal:g} € – nur deine Marken, Premium-Marken & Raritäten (/radar)")
    if monitor.paused_examples:
        names += (f"\n⏸ Beispiel-Suchen pausiert: {', '.join(monitor.paused_examples)} – sie meldeten alles ohne "
                  "Rabatt-Prüfung (/suchen, /weiter Nr. zum Einschalten)")
    workers = " + ".join(f"Sucher {chr(65 + i)}" for i in range(max(1, cfg.workers)))
    ai_on = monitor.reviewer is not None and monitor.reviewer.enabled
    names += (f"\n🔁 {workers}: jede Marke im eigenen Takt – viel los = alle ~10–25 s "
              f"(alle {cfg.request_gap_seconds:g} s eine Anfrage, /status)"
              + (f"\n🤖 KI-Bildcheck: an ({cfg.ai_model}, max. {cfg.ai_max_checks_per_day}/Tag)" if ai_on
                 else "\n🤖 KI-Bildcheck: aus (/ki)"))
    b = monitor.brain
    from .tags import count_tags
    if b is not None and b.enabled:
        names += (f"\n🧠 Bildmodell: {b.embedder.label} · {count_tags()} Tags · {b.data.count():,} Bilder im Datensatz (/modell)"
                  .replace(",", "."))
    elif b is not None:
        names += "\n🧠 Eigenes Modell: nicht installiert (ki-installieren.bat)"
    names += f"\n🛡 Fake-Ampel: {monitor.ampel_mode()} (/ampel)"
    log.info("Vinted-Bot %s gestartet (vinted.%s, alle %ss). Suchen: %s",
             __version__, cfg.domain, cfg.interval_seconds, names)
    notifier.send_text(
        f"🤖 <b>Vinted-Bot läuft</b>\nSuchen: {names}\n"
        f"Ich lerne kurz die aktuellen Preise und melde dir dann neue Treffer."
        + ("\n💸 Angebote per Button: an" if account else "")
        + ("\n/hilfe zeigt alle Befehle." if controller else ""))
    monitor.run_forever()
    storage.close()
    return 0


def build_reviewer(cfg: Config, storage: Storage, monitor: Any) -> Any:
    """KI-Bildcheck vorbereiten (wird erst beim ersten Check mit Anthropic verbunden)."""
    try:
        from .vision import AiReviewer
    except ImportError:  # pragma: no cover
        return None
    photo_client = VintedClient(cfg.domain, proxy=cfg.proxy)  # eigene Sitzung für den KI-Thread

    def photos(item: Any) -> list[str]:
        monitor.pacer.wait(monitor.stop_event)  # auch Foto-Abfragen halten den Takt ein
        return photo_client.item_photos(item)

    return AiReviewer(cfg, storage, photos, photo_client.fetch_bytes)


def build_brain(cfg: Config, notifier: Any) -> Any:
    """Eigenes Bildmodell (sammelt & trainiert lokal). Ohne PyTorch/open_clip bleibt es aus."""
    if not cfg.ml_enabled:
        return None
    try:
        from .brain import Brain
    except ImportError as e:  # z. B. numpy fehlt -> Bot läuft trotzdem, nur ohne eigenes Modell
        log.warning("Eigenes Bildmodell aus: %s – ki-installieren.bat ausführen (bzw. ./ki-installieren.sh).", e)
        return None
    photo_client = VintedClient(cfg.domain, proxy=cfg.proxy)
    brain = Brain(cfg, photo_client.fetch_bytes, report=notifier.send_text)
    if not brain.embedder.installed():
        log.info("Eigenes Bildmodell: noch nicht installiert (ki-installieren.bat) – der Bot läuft ohne.")
    return brain


def _wait_forever(controller: Any) -> None:
    try:
        while controller.is_alive():
            time.sleep(1)
    except KeyboardInterrupt:
        controller.stop()


def cmd_scan(cfg: Config, top: int, send: bool, name_filter: str = "") -> int:
    """Zeigt sofort die besten aktuellen Angebote jeder Suche (ohne etwas als gesehen zu markieren)."""
    from .monitor import Monitor

    storage = Storage(cfg.database)
    notifier, _ = build_notifiers(cfg, offers_via_bot=False)
    monitor = Monitor(cfg, VintedClient(cfg.domain, proxy=cfg.proxy), storage, notifier)
    searches = [s for s in monitor.all_searches()
                if s.enabled and name_filter.lower() in s.name.lower()]
    if not searches:
        print("Keine (passenden) Suchen in der config.yaml.")
        return 2
    for search in searches:
        print(f"\n=== {search.name} ===")
        try:
            items = monitor.client.search(query_for_search(search, cfg.currency), per_page=monitor._per_page(search))
        except VintedError as e:
            print(f"  Fehler: {e}")
            continue
        alerts = monitor.rank_items(search, items)
        hint = " (nur frische, weit unter Marktpreis)" if search.is_resale else ""
        print(f"  {len(items)} Artikel gefunden, {len(alerts)} erfüllen deine Kriterien{hint}")
        for a in alerts[:top]:
            mark = "🔥" if a.score.is_top else "  "
            extra = ""
            if a.score.discount is not None:
                extra = f"  −{a.score.discount:.0%}"
            if search.is_resale and a.score.profit is not None:
                extra += f"  Gewinn ~{money(a.score.profit, a.item.currency)}"
            print(f"  {mark} {a.score.total:3d}/100  {money(a.item.price, a.item.currency):>10}{extra}  {a.item.title[:50]}")
            print(f"              {a.item.url}")
            if send:
                storage.save_item(a.item)
                notifier.send_alert(a)
        time.sleep(2)
    storage.close()
    return 0


def cmd_sample(cfg: Config, send: bool) -> int:
    """Testlauf mit Musterdaten: zeigt, was der Bot mit deinen Einstellungen melden würde."""
    from .sample_data import run_sample

    storage = Storage(cfg.database) if os.path.exists(cfg.database) else None
    result = run_sample(cfg, source_storage=storage)
    print(result.summary_text())
    if send:
        notifier, _ = build_notifiers(cfg, offers_via_bot=False)
        notifier.send_text(result.summary_html())
        for alert in result.alerts[:3]:
            alert.demo = True
            alert.search_name = "🧪 PROBELAUF (Musterdaten – nicht echt)"
            notifier.send_alert(alert)
    if storage:
        storage.close()
    return 0


def cmd_test_notify(cfg: Config) -> int:
    notifier, _ = build_notifiers(cfg, offers_via_bot=False)
    if not notifier:
        print("Kein Kanal eingerichtet. Trage Telegram, Discord oder ntfy in der config.yaml ein.")
        return 2
    item = Item(id=1, title="TEST – Nike Air Max 90 (Beispiel)", price=24.0, total_price=25.9,
                brand="Nike", size="43", condition="Sehr gut", url=f"{cfg.web_base}/catalog?search_text=nike",
                photo_url=None, favourites=4, created_ts=int(time.time()) - 120, seller_login="beispiel")
    score = score_item(item, 45.0, cfg.top_deal_score)
    ok = notifier.send_alert(Alert(item=item, search_name="Test", score=score, buy_url=item.url,
                                   offers=suggest_offers(item.price, cfg.offer_discounts)))
    print("✅ Testnachricht verschickt." if ok else "❌ Senden fehlgeschlagen – siehe Meldungen oben.")
    return 0 if ok else 1


def cmd_chat_id(cfg: Config) -> int:
    if not cfg.telegram_token:
        print("Trage zuerst den Bot-Token (von @BotFather) in der config.yaml ein.")
        return 2
    tg = TelegramNotifier(cfg.telegram_token, "")
    print("Schreib deinem Bot jetzt in Telegram eine Nachricht (z. B. /start) … (Strg+C zum Abbrechen)")
    offset = 0
    while True:
        try:
            data = tg.api("getUpdates", offset=offset, timeout=25)
        except Exception as e:  # noqa: BLE001
            print(f"Fehler: {e}")
            return 1
        for upd in data.get("result", []):
            offset = upd["update_id"] + 1
            chat = (upd.get("message") or {}).get("chat") or {}
            if chat.get("id"):
                print(f"\n✅ Deine Chat-ID: {chat['id']}\nTrage sie in der config.yaml bei telegram → chat_id ein.")
                tg.api("getUpdates", offset=offset, timeout=0)  # Nachricht als gelesen markieren
                return 0


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="vinted_bot", description="Vinted-Deal-Bot")
    parser.add_argument("-c", "--config", default=os.environ.get("VINTED_BOT_CONFIG", "config.yaml"),
                        help="Pfad zur config.yaml")
    parser.add_argument("-v", "--verbose", action="store_true", help="mehr Details ausgeben")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="Bot dauerhaft starten (Standard)")
    p_scan = sub.add_parser("scan", help="beste aktuelle Angebote sofort anzeigen")
    p_scan.add_argument("--top", type=int, default=5, help="wie viele pro Suche (Standard 5)")
    p_scan.add_argument("--send", action="store_true", help="die Treffer auch als Benachrichtigung schicken")
    p_scan.add_argument("--suche", default="", help="nur Suchen, deren Name diesen Text enthält")
    sub.add_parser("test-notify", help="Testnachricht an alle Kanäle schicken")
    p_demo = sub.add_parser("probelauf", help="Testlauf mit Musterdaten: zeigt, was gemeldet würde")
    p_demo.add_argument("--send", action="store_true", help="Ergebnis auch per Telegram & Co. schicken")
    sub.add_parser("chat-id", help="Telegram-Chat-ID herausfinden")
    args = parser.parse_args(argv)

    # Nur die Meldungen des Bots zeigen – nicht das Download-Protokoll von Hugging Face, open_clip & Co.
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.WARNING,
                        format="%(asctime)s %(levelname)-7s [%(threadName)s] %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("vinted_bot").setLevel(logging.DEBUG if args.verbose else logging.INFO)
    threading.current_thread().name = "Bot"
    for noisy in ("urllib3", "curl_cffi", "httpx", "httpcore", "filelock"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    logging.getLogger("huggingface_hub").setLevel(logging.ERROR)
    os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")   # harmloser Windows-Hinweis
    warnings.filterwarnings("ignore", message=".*unauthenticated requests.*")
    warnings.filterwarnings("ignore", message=".*symlinks.*")
    try:
        cfg = load_config(args.config)
    except ConfigError as e:
        log.error("%s", e)
        return 2

    command = args.command or "run"
    if command == "scan":
        return cmd_scan(cfg, args.top, args.send, args.suche)
    if command == "test-notify":
        return cmd_test_notify(cfg)
    if command == "probelauf":
        return cmd_sample(cfg, args.send)
    if command == "chat-id":
        return cmd_chat_id(cfg)
    return cmd_run(cfg)


if __name__ == "__main__":
    sys.exit(main())
