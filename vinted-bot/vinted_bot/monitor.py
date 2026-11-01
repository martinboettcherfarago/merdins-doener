"""Die Überwachungsschleife: Suchen abfragen, neue Artikel bewerten, Benachrichtigungen schicken."""

from __future__ import annotations

import logging
import random
import threading
import time
from typing import Any, Callable, Optional

from .config import RESALE_LEVELS, TREND_BRANDS, Config, SearchConfig
from .models import Item
from .notify import Alert
from .scoring import (TYPE_LABELS, market_reference, meets_targets, normalize, passes_filters, price_group,
                      score_item, suggest_offers)
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
        self._migrate_old_resale_searches()

    def _migrate_old_resale_searches(self) -> None:
        """Ältere Versionen haben die Resale-Ziele fest in jede Telegram-Suche geschrieben.
        Diese Standardwerte entfernen, damit die Schnäppchen-Stufe (/stufe) für alle gilt."""
        if self.storage.get_state("migrated:resale_targets") == "1":
            return
        old = {"max_age_minutes": 10, "min_discount": 40.0, "min_profit": 15.0, "min_condition": "gut"}
        for s in self.storage.custom_searches():
            if s.is_resale:
                for key, value in old.items():
                    if getattr(s, key) == value:
                        setattr(s, key, None)
                self.storage.add_search(s)
        self.storage.set_state("migrated:resale_targets", "1")

    # -- Schnäppchen-Stufe & Trend-Marken --------------------------------------------

    @property
    def resale_level(self) -> Optional[str]:
        level = self.storage.get_state("resale_level")
        return level if level in RESALE_LEVELS else None

    def resale_targets(self) -> dict[str, Any]:
        """Ziele für Resale-Suchen: per Telegram gewählte Stufe, sonst die Werte aus der config.yaml."""
        level = self.resale_level
        return dict(RESALE_LEVELS[level]) if level else dict(self.cfg.resale_targets)

    def effective(self, search: SearchConfig) -> SearchConfig:
        return search.with_targets(self.resale_targets())

    def trend_brands(self) -> list[str]:
        """Eingebaute Trend-Marken minus die, die du entfernt hast, plus deine eigenen."""
        removed = {normalize(b) for b in self.storage.get_list("trends_removed")}
        brands = [b for b in TREND_BRANDS if normalize(b) not in removed]
        known = {normalize(b) for b in brands}
        for b in self.storage.get_list("trends_added"):
            if normalize(b) not in known:
                brands.append(b)
                known.add(normalize(b))
        return brands

    def add_trend_brand(self, brand: str) -> str:
        """Nimmt eine Marke in die Trend-Liste auf. Gibt den verwendeten Namen zurück."""
        key = normalize(brand)
        builtin = next((b for b in TREND_BRANDS if normalize(b) == key), None)
        removed = [b for b in self.storage.get_list("trends_removed") if normalize(b) != key]
        self.storage.set_list("trends_removed", removed)
        if builtin:
            return builtin
        added = self.storage.get_list("trends_added")
        existing = next((b for b in added if normalize(b) == key), None)
        if existing:
            return existing
        self.storage.set_list("trends_added", added + [brand])
        return brand

    def remove_trend_brand(self, brand: str) -> Optional[str]:
        """Entfernt eine Marke aus der Trend-Liste. Gibt den Namen zurück (None, wenn nicht drin)."""
        key = normalize(brand)
        current = next((b for b in self.trend_brands() if normalize(b) == key), None)
        if not current:
            return None
        self.storage.set_list("trends_added", [b for b in self.storage.get_list("trends_added")
                                               if normalize(b) != key])
        if any(normalize(b) == key for b in TREND_BRANDS):
            self.storage.set_list("trends_removed", self.storage.get_list("trends_removed") + [current])
        return current

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

    def _max_age_seconds(self, search: SearchConfig) -> int:
        minutes = search.max_age_minutes if search.max_age_minutes is not None else self.cfg.max_item_age_minutes
        return int(minutes or 0) * 60

    def _per_page(self, search: SearchConfig) -> int:
        # Resale-Suchen über ganze Marken: mehr Artikel pro Abfrage, damit nichts Frisches durchrutscht
        return 96 if search.is_resale else self.cfg.per_page

    def evaluate(self, search: SearchConfig, item: Item, now: float, kind: str = "new",
                 old_price: Optional[float] = None, extra: Optional[list[Item]] = None) -> Optional[Alert]:
        """Bewertet einen Artikel. Gibt einen Alarm zurück, wenn er alle Filter und Ziele der Suche erfüllt."""
        ok, _why = passes_filters(item, search, self.cfg.global_exclude_words)
        if not ok:
            return None
        group = price_group(search, item)
        group_prices = self.storage.group_history(group)
        search_prices = self.storage.price_history(search.name)
        if extra is not None:  # Scan: die anderen aktuellen Treffer als Vergleich mitzählen
            others = [i for i in extra if i.id != item.id]
            group_prices = group_prices + [i.price for i in others if price_group(search, i) == group]
            search_prices = search_prices + [i.price for i in others]
        ptype = group.rsplit("|", 1)[-1]
        brand = (item.brand or (search.brands[0] if search.brands else "")) if search.is_resale else ""
        label = f"ähnliche {brand + ' ' if brand else ''}{TYPE_LABELS.get(ptype, 'Artikel')}"
        ref = market_reference(search, group_prices, search_prices, label)
        score = score_item(item, ref, self.cfg.top_deal_score, now, resale=search.is_resale,
                           shipping=self.cfg.shipping_estimate)
        if kind == "price_drop" and old_price:
            score.reasons.insert(0, f"Preis um {1 - item.price / old_price:.0%} gesenkt")
        ok, _why = meets_targets(search, score)
        if not ok:
            return None
        return Alert(item=item, search_name=search.name, score=score, buy_url=item.buy_url(self.cfg.web_base),
                     kind=kind, old_price=old_price, resale=search.is_resale,
                     offers=suggest_offers(item.price, self.cfg.offer_discounts))

    def check_search(self, search: SearchConfig) -> list[Alert]:
        """Fragt eine Suche ab und liefert die Treffer, die gemeldet werden sollen."""
        search = self.effective(search)
        items = self.client.search(query_for_search(search, self.cfg.currency), per_page=self._per_page(search))
        self.stats["checked"] += len(items)
        seeded = self.storage.is_seeded(search.name)
        now = self.clock()
        max_age = self._max_age_seconds(search)
        drop_factor = 1 - self.cfg.price_drop_percent / 100

        alerts = []
        for item in items:
            prev = self.storage.seen_price(search.name, item.id)
            alert = None
            if prev is None:
                too_old = bool(max_age and item.created_ts and now - item.created_ts > max_age)
                # erster Durchlauf: nur Preise lernen; alte (nur hochgeschobene) Artikel nie melden
                if seeded and not too_old:
                    alert = self.evaluate(search, item, now)  # bewerten, bevor der eigene Preis mitzählt
                self.storage.mark_seen(search.name, item)
                self.storage.add_price(search.name, item.price, price_group(search, item))
            elif item.price != prev:
                self.storage.mark_seen(search.name, item)
                if item.price <= prev * drop_factor:
                    alert = self.evaluate(search, item, now, "price_drop", prev)
            if alert:
                alerts.append(alert)

        if not seeded:
            self.storage.set_seeded(search.name)
            log.info("Suche '%s': %d Artikel als Ausgangsbasis gespeichert.", search.name, len(items))
        alerts.sort(key=lambda a: a.score.total, reverse=True)
        return alerts

    def rank_items(self, search: SearchConfig, items: list[Item]) -> list[Alert]:
        """Für 'scan': alle aktuellen Treffer bewerten, ohne etwas zu speichern."""
        search = self.effective(search)
        now = self.clock()
        max_age = self._max_age_seconds(search) if search.is_resale else 0
        out = []
        for item in items:
            if max_age and item.created_ts and now - item.created_ts > max_age:
                continue
            alert = self.evaluate(search, item, now, extra=items)
            if alert:
                out.append(alert)
        out.sort(key=lambda a: a.score.total, reverse=True)
        return out

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
