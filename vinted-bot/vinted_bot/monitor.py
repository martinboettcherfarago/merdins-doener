"""Die Überwachungsschleife: Suchen abfragen, neue Artikel bewerten, Benachrichtigungen schicken."""

from __future__ import annotations

import logging
import random
import threading
import time
from typing import Any, Callable, Optional

from .config import Config, SearchConfig
from .models import Item
from .notify import Alert
from .scoring import passes_filters, reference_price, score_item, suggest_offers
from .storage import Storage
from .vinted import VintedBlocked, VintedClient, VintedRateLimited, query_for_search

log = logging.getLogger(__name__)


class Monitor:
    def __init__(self, cfg: Config, client: VintedClient, storage: Storage, notifier: Any,
                 clock: Callable[[], float] = time.time):
        self.cfg = cfg
        self.client = client
        self.storage = storage
        self.notifier = notifier
        self.clock = clock
        self.stop_event = threading.Event()
        self.pause_between_searches = (1.5, 4.0)
        self.stats: dict[str, Any] = {"started": clock(), "cycles": 0, "checked": 0, "alerts": 0,
                                      "errors": 0, "last_error": "", "last_cycle": 0.0}
        self._blocked_notified = False

    # -- Suchen ------------------------------------------------------------------

    def all_searches(self) -> list[SearchConfig]:
        names = {s.name for s in self.cfg.searches}
        custom = [s for s in self.storage.custom_searches() if s.name not in names]
        return list(self.cfg.searches) + custom

    def active_searches(self) -> list[SearchConfig]:
        return [s for s in self.all_searches() if s.enabled and not self.storage.is_disabled(s.name)]

    @property
    def paused(self) -> bool:
        return self.storage.get_state("paused") == "1"

    # -- Kernlogik ---------------------------------------------------------------

    def _make_alert(self, search: SearchConfig, item: Item, history: list[float], now: float,
                    kind: str = "new", old_price: Optional[float] = None) -> Optional[Alert]:
        ok, _why = passes_filters(item, search, self.cfg.global_exclude_words)
        if not ok:
            return None
        ref = reference_price(search.market_price, history)
        score = score_item(item, ref, self.cfg.top_deal_score, now)
        if kind == "price_drop":
            score.reasons.insert(0, f"Preis um {1 - item.price / old_price:.0%} gesenkt")
        if score.total < search.min_score:
            return None
        return Alert(item=item, search_name=search.name, score=score, buy_url=item.buy_url(self.cfg.web_base),
                     kind=kind, old_price=old_price,
                     offers=suggest_offers(item.price, self.cfg.offer_discounts))

    def check_search(self, search: SearchConfig) -> list[Alert]:
        """Fragt eine Suche ab und liefert die Treffer, die gemeldet werden sollen."""
        items = self.client.search(query_for_search(search, self.cfg.currency), per_page=self.cfg.per_page)
        self.stats["checked"] += len(items)
        seeded = self.storage.is_seeded(search.name)
        now = self.clock()
        max_age = self.cfg.max_item_age_minutes * 60
        drop_factor = 1 - self.cfg.price_drop_percent / 100

        candidates: list[tuple[Item, str, Optional[float]]] = []
        for item in items:
            prev = self.storage.seen_price(search.name, item.id)
            if prev is None:
                self.storage.mark_seen(search.name, item)
                self.storage.add_price(search.name, item.price)
                if not seeded:
                    continue  # erster Durchlauf: nur Preise lernen, nicht alles Alte melden
                if max_age and item.created_ts and now - item.created_ts > max_age:
                    continue  # alter Artikel, der nur nach oben geschoben wurde
                candidates.append((item, "new", None))
            elif item.price != prev:
                self.storage.mark_seen(search.name, item)
                if item.price <= prev * drop_factor:
                    candidates.append((item, "price_drop", prev))

        if not seeded:
            self.storage.set_seeded(search.name)
            log.info("Suche '%s': %d Artikel als Ausgangsbasis gespeichert.", search.name, len(items))

        alerts = []
        if candidates:
            history = self.storage.price_history(search.name)
            for item, kind, old in candidates:
                alert = self._make_alert(search, item, history, now, kind, old)
                if alert:
                    alerts.append(alert)
        alerts.sort(key=lambda a: a.score.total, reverse=True)
        return alerts

    def run_once(self) -> int:
        """Ein Durchlauf über alle aktiven Suchen. Gibt die Zahl der gesendeten Meldungen zurück."""
        sent = 0
        searches = self.active_searches()
        for i, search in enumerate(searches):
            if self.stop_event.is_set():
                break
            try:
                alerts = self.check_search(search)
            except (VintedBlocked, VintedRateLimited):
                raise
            except Exception as e:  # noqa: BLE001 - eine kaputte Suche darf den Bot nicht stoppen
                self.stats["errors"] += 1
                self.stats["last_error"] = f"{search.name}: {e}"
                log.warning("Suche '%s' fehlgeschlagen: %s", search.name, e)
                alerts = []
            for alert in alerts:
                self.storage.save_item(alert.item)
                if self.paused:
                    continue
                log.info("%s %s – %s (%s)", "🔥" if alert.score.is_top else "🆕", alert.item.title,
                         alert.item.price, alert.score.total)
                if self.notifier.send_alert(alert):
                    sent += 1
                    self.stats["alerts"] += 1
            if i < len(searches) - 1:
                self.stop_event.wait(random.uniform(*self.pause_between_searches))
        self.stats["cycles"] += 1
        self.stats["last_cycle"] = self.clock()
        return sent

    def run_forever(self) -> None:
        backoff = 0.0
        last_cleanup = 0.0
        while not self.stop_event.is_set():
            started = time.monotonic()
            wait: Optional[float] = None
            try:
                self.run_once()
                backoff = 0.0
                if self._blocked_notified:
                    self._blocked_notified = False
                    self.notifier.send_text("✅ Vinted antwortet wieder – die Suche läuft weiter.")
            except VintedRateLimited as e:
                wait = max(60.0, e.retry_after)
                log.warning("Zu viele Anfragen – Pause für %.0f s.", wait)
            except VintedBlocked as e:
                backoff = min(900.0, backoff * 2 if backoff else 60.0)
                wait = backoff
                self.stats["errors"] += 1
                self.stats["last_error"] = str(e)
                log.warning("%s Neuer Versuch in %.0f s.", e, wait)
                if not self._blocked_notified:
                    self._blocked_notified = True
                    self.notifier.send_text(f"⚠️ {e}\nIch versuche es automatisch weiter. Wenn das oft "
                                            "passiert: Intervall in der config.yaml erhöhen.")
            if time.time() - last_cleanup > 86400:
                self.storage.cleanup()
                last_cleanup = time.time()
            if wait is None:
                interval = self.cfg.interval_seconds
                wait = max(5.0, interval + random.uniform(0, interval * 0.3) - (time.monotonic() - started))
            self.stop_event.wait(wait)

    def stop(self) -> None:
        self.stop_event.set()
