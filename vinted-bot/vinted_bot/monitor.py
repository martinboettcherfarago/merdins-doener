"""Die Überwachungsschleife: Suchen abfragen, neue Artikel bewerten, Benachrichtigungen schicken."""

from __future__ import annotations

import logging
import random
import threading
import time
from dataclasses import replace
from typing import Any, Callable, Optional

from .catalog import hidden_label, is_kids, is_retro, type_hidden
from .config import RESALE_LEVELS, TREND_WATCHES, Config, SearchConfig, watch_name
from .knowledge import brand_key, estimate_item, rarity, size_matches, trend_match
from .models import Item
from .notify import Alert
from .scoring import (TYPE_LABELS, market_reference, meets_targets, normalize, passes_filters, price_group,
                      product_type, score_item, suggest_offers)
from .storage import Storage
from .vinted import VintedBlocked, VintedClient, VintedRateLimited, query_for_search

log = logging.getLogger(__name__)

JUNK_TYPES = {"kleinkram", "verpackung"}   # Patches, Sticker, Kartons, Staubbeutel …
MEDIA_TYPES = {"buch", "medien"}           # Bücher, Magazine, Kataloge, CDs …


class Monitor:
    def __init__(self, cfg: Config, client: VintedClient, storage: Storage, notifier: Any,
                 clock: Callable[[], float] = time.time):
        self.cfg = cfg
        self.client = client
        self.storage = storage
        self.notifier = notifier
        self.clock = clock
        self.stop_event = threading.Event()
        self.pause_between_searches = (0.8, 2.0)
        self.stats: dict[str, Any] = {"started": clock(), "cycles": 0, "checked": 0, "alerts": 0,
                                      "errors": 0, "last_error": "", "last_cycle": 0.0}
        self._blocked_notified = False
        self._lock = threading.Lock()
        self.stats.update({"workers": {}, "ai_checked": 0, "ai_fakes": 0, "ai_finds": 0})
        self.reviewer: Any = None   # KI-Bildcheck (vision.AiReviewer), wird von __main__ gesetzt
        self.pacer = Pacer(0.0)
        self.reject_log: Optional[list[tuple[str, Item, str]]] = None  # für Probelauf/Fehlersuche
        self._migrate_old_resale_searches()
        self._rename_old_searches()
        self._apply_trend_presets()
        self.min_cycle_wait = 3.0

    def _rename_old_searches(self) -> None:
        """Version 2: 'Resale · X' heißt jetzt 'Marke · X' bzw. 'Trend · X' (gesucht wurde nie nach 'Resale')."""
        if self.storage.get_state("migrated:names_v2") == "1":
            return
        for s in self.storage.custom_searches():
            if s.name.startswith("Resale · "):
                self.storage.rename_search(s.name, watch_name(s.name.split(" · ", 1)[1]))
        for key in self.storage.state_keys("disabled:Resale · ") + self.storage.state_keys("seeded:Resale · "):
            prefix, old = key.split(":", 1)
            value = self.storage.get_state(key)
            self.storage.delete_state(key)
            self.storage.set_state(f"{prefix}:{watch_name(old.split(' · ', 1)[1])}", value or "1")
        self.storage.set_state("migrated:names_v2", "1")

    def _apply_trend_presets(self) -> None:
        """Schon gespeicherte Trend-Suchen bekommen neue Voreinstellungen (z. B. mehr Vintage Adidas)."""
        from .config import TREND_OVERRIDES
        if self.storage.get_state("migrated:trend_presets_v1") == "1":
            return
        presets = {normalize(k): v for k, v in TREND_OVERRIDES.items()}
        for s in self.storage.custom_searches():
            preset = presets.get(normalize(s.keywords or ""))
            if s.is_resale and preset:
                for key, value in preset.items():
                    if getattr(s, key) is None:
                        setattr(s, key, value)
                self.storage.add_search(s)
        self.storage.set_state("migrated:trend_presets_v1", "1")

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
        brands = [b for b in TREND_WATCHES if normalize(b) not in removed]
        known = {normalize(b) for b in brands}
        for b in self.storage.get_list("trends_added"):
            if normalize(b) not in known:
                brands.append(b)
                known.add(normalize(b))
        return brands

    def add_trend_brand(self, brand: str) -> str:
        """Nimmt eine Marke in die Trend-Liste auf. Gibt den verwendeten Namen zurück."""
        key = normalize(brand)
        builtin = next((b for b in TREND_WATCHES if normalize(b) == key), None)
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
        if any(normalize(b) == key for b in TREND_WATCHES):
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

    # -- Filter fürs Schnäppchen-Radar (Größe, Kategorien, nur Raritäten) ---------------

    def global_filters(self) -> dict[str, Any]:
        """Per Telegram geänderte Filter, sonst die aus der config.yaml."""
        sizes = self.storage.get_json("filter_sizes")
        types = self.storage.get_json("filter_exclude_types")
        rare = self.storage.get_state("only_rare")
        return {
            "sizes": list(self.cfg.filter_sizes) if sizes is None else list(sizes),
            "exclude_types": list(self.cfg.filter_exclude_types) if types is None else list(types),
            "only_rare": self.cfg.only_rare if rare is None else rare == "1",
        }

    # -- Lernen aus 👍 / 👎 -----------------------------------------------------------

    def preferences(self) -> dict[str, int]:
        prefs = self.storage.get_json("prefs", {})
        return prefs if isinstance(prefs, dict) else {}

    def _pref_votes(self, item: Item, ptype: str) -> tuple[int, int]:
        prefs = self.preferences()
        return int(prefs.get(f"brand:{brand_key(item.brand)}", 0)), int(prefs.get(f"type:{ptype}", 0))

    def record_feedback(self, item_id: int, positive: bool) -> str:
        """Merkt sich 👍/👎 zu Marke und Produkttyp. Gibt eine Antwort für den Chat zurück."""
        info = self.storage.get_item(item_id)
        if not info:
            return "Artikel nicht mehr gespeichert."
        if self.storage.get_state(f"fb:{item_id}"):
            return "Schon bewertet – danke!"
        self.storage.set_state(f"fb:{item_id}", "1")
        brand = brand_key(info.get("brand") or "")
        ptype = info.get("type") or product_type(info.get("title") or "")
        prefs = self.preferences()
        delta = 1 if positive else -1
        for key in (f"brand:{brand}" if brand else "", f"type:{ptype}"):
            if key:
                prefs[key] = int(prefs.get(key, 0)) + delta
        self.storage.set_json("prefs", prefs)
        if self.reviewer is not None:  # der KI-Check lernt deinen Geschmack mit
            self.reviewer.learn(info.get("title") or "", positive)
        label = TYPE_LABELS.get(ptype, ptype)
        if not positive and ptype != "sonstiges" and prefs.get(f"type:{ptype}", 0) <= -3:
            hidden = self.global_filters()["exclude_types"]
            if ptype not in hidden:
                self.storage.set_json("filter_exclude_types", hidden + [ptype])
                return f"👎 Verstanden – {label} blende ich ab jetzt aus. (/mit {ptype} holt sie zurück)"
        if not positive and brand and prefs.get(f"brand:{brand}", 0) == -3:
            return (f"👎 Verstanden – {info.get('brand') or brand} sortiere ich ab jetzt aus. "
                    "(/vorlieben reset macht das rückgängig)")
        if positive:
            return f"👍 Gemerkt – mehr wie das ({info.get('brand') or label})!"
        return "👎 Gemerkt – davon zeige ich dir weniger."

    # -- Bewertung -----------------------------------------------------------------

    @staticmethod
    def _search_text(search: SearchConfig) -> str:
        if search.keywords:
            return search.keywords
        if search.url:
            from .vinted import query_from_url
            return query_from_url(search.url).search_text
        return ""

    def _learnable(self, search: SearchConfig, item: Item) -> bool:
        """Nur aus echten, vergleichbaren Angeboten lernen – nicht aus Fakes, Kindergrößen, Kleinkram,
        Suchanzeigen oder "im Carhartt Style"-Teilen (die würden den Marktpreis nach unten ziehen)."""
        ptype = product_type(item.title)
        if ptype in JUNK_TYPES or ptype in MEDIA_TYPES or is_kids(item.title, item.size):
            return False
        loose = replace(search, min_price=None, max_price=None, sizes=[], must_contain=[], min_condition=None)
        return passes_filters(item, loose, self.cfg.global_exclude_words)[0]

    def _junk_reason(self, search: SearchConfig, item: Item, ptype: str) -> str:
        """Patches, Sticker, Verpackung, Bücher … sind keine Schnäppchen – außer du suchst genau danach."""
        if ptype not in JUNK_TYPES and ptype not in MEDIA_TYPES:
            return "" if not (search.is_resale and item.price < 2) else \
                "unter 2 € (meist Lockangebot oder Kleinkram)"
        wanted = product_type(self._search_text(search))
        if wanted == ptype or (wanted in JUNK_TYPES and ptype in JUNK_TYPES) or \
                (wanted in MEDIA_TYPES and ptype in MEDIA_TYPES):
            return ""
        kind = "Kleinkram" if ptype in JUNK_TYPES else "Buch/Medien"
        return f"{kind}: {TYPE_LABELS.get(ptype, ptype)} – kein Kleidungsstück"

    def evaluate(self, search: SearchConfig, item: Item, now: float, kind: str = "new",
                 old_price: Optional[float] = None, extra: Optional[list[Item]] = None) -> Optional[Alert]:
        """Bewertet einen Artikel. Gibt einen Alarm zurück, wenn er alle Filter und Ziele der Suche erfüllt."""
        return self.explain(search, item, now, kind, old_price, extra)[0]

    def explain(self, search: SearchConfig, item: Item, now: float, kind: str = "new",
                old_price: Optional[float] = None, extra: Optional[list[Item]] = None
                ) -> tuple[Optional[Alert], str]:
        """Wie evaluate, liefert aber auch den Grund, warum ein Artikel NICHT gemeldet wird."""
        ok, why = passes_filters(item, search, self.cfg.global_exclude_words)
        if not ok:
            return None, why
        ptype = product_type(item.title)
        junk = self._junk_reason(search, item, ptype)
        if junk:
            return None, junk
        rare = rarity(item)
        trend = trend_match(item.title)
        est = estimate_item(item, ptype)
        brand_votes = type_votes = 0
        if search.is_resale:
            f = self.global_filters()
            if type_hidden(ptype, f["exclude_types"]):
                return None, f"Kategorie ausgeblendet ({hidden_label(ptype, f['exclude_types'])})"
            if not search.sizes and f["sizes"] and not size_matches(item.size, f["sizes"]):
                return None, f"Größe {item.size or '?'} passt nicht ({', '.join(f['sizes'])})"
            if f["only_rare"] and not rare.level:
                return None, "keine Rarität"
            brand_votes, type_votes = self._pref_votes(item, ptype)
            if brand_votes + type_votes <= -3:
                return None, "von dir aussortiert (👎)"
            if search.sweep and not rare.level and not trend and est.tier in (None, "budget"):
                return None, "Alles-Radar: keine gefragte Marke"

        group = price_group(search, item)
        group_prices = self.storage.group_history(group)
        search_prices = self.storage.price_history(search.name)
        if extra is not None:  # Scan/Probelauf: die anderen aktuellen Treffer als Vergleich mitzählen
            others = [i for i in extra if i.id != item.id]
            group_prices = group_prices + [i.price for i in others if price_group(search, i) == group]
            search_prices = search_prices + [i.price for i in others]
        # Vorwissen: Preisschätzung aus Marke, Kategorie (und genaueren Werten für Trend-Marken)
        brand = est.brand or (search.brands[0] if search.brands else "")
        own_prices = self.storage.get_json("own_prices", {}) or {}
        own = own_prices.get(f"{brand_key(brand)}|{ptype}") if brand else None
        label = f"ähnliche {brand + ' ' if brand else ''}{TYPE_LABELS.get(ptype, 'Artikel')}"
        ref = market_reference(search, group_prices, search_prices, label, prior=est.base, own_price=own)
        if ref.price is not None and ref.basis.startswith("Startwert"):
            ref.basis = f"Schätzung: {est.basis}"
        elif ref.basis.endswith("+ Vorwissen"):
            ref.basis = ref.basis.replace("+ Vorwissen", f"+ Schätzung ({est.basis})")
        pref_pts = max(-15.0, min(15.0, 3.0 * (brand_votes + type_votes)))
        score = score_item(item, ref, self.cfg.top_deal_score, now, resale=search.is_resale,
                           shipping=self.cfg.shipping_estimate, rare=rare, pref_pts=pref_pts, est=est,
                           trend=trend)
        if kind == "price_drop" and old_price:
            score.reasons.insert(0, f"Preis um {1 - item.price / old_price:.0%} gesenkt")
        ok, why = meets_targets(search, score)
        if not ok:
            if extra is None:
                self._maybe_second_look(search, item, score, why, rare, trend, ptype, kind)
            return None, why
        return Alert(item=item, search_name=search.name, score=score, buy_url=item.buy_url(self.cfg.web_base),
                     kind=kind, old_price=old_price, resale=search.is_resale, ptype=ptype,
                     offers=suggest_offers(item.price, self.cfg.offer_discounts)), ""

    def check_search(self, search: SearchConfig, client: Any = None, worker: str = "") -> list[Alert]:
        """Fragt eine Suche ab und liefert die Treffer, die gemeldet werden sollen."""
        search = self.effective(search)
        items = (client or self.client).search(query_for_search(search, self.cfg.currency), per_page=self._per_page(search))
        with self._lock:
            self.stats["checked"] += len(items)
            if worker:
                self.stats["workers"].setdefault(worker, {"cycles": 0, "checked": 0, "alerts": 0})
                self.stats["workers"][worker]["checked"] += len(items)
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
                    alert, why = self.explain(search, item, now)  # bewerten, bevor der eigene Preis mitzählt
                    if alert is None and self.reject_log is not None:
                        self.reject_log.append((search.name, item, why))
                elif seeded and self.reject_log is not None:
                    self.reject_log.append((search.name, item, f"schon {int((now - item.created_ts) / 60)} Min. online"))
                self.storage.mark_seen(search.name, item)
                if self._learnable(search, item):
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

    # -- Melden: direkt oder über den KI-Bildcheck ----------------------------------

    def _deliver(self, alert: Alert, worker: str = "") -> bool:
        """Meldung verschicken – Doppelte aussortieren (auch zwischen Sucher A und B) und ggf. KI-Check."""
        if alert.kind == "new":
            if not self.storage.claim_alert(alert.item.id):
                return False  # schon von einer anderen Suche bzw. einem anderen Sucher gemeldet
        else:
            self.storage.mark_alerted(alert.item.id)
        self.storage.save_item(alert.item, alert.ptype)
        if self.paused:
            return False
        alert.worker = worker
        if self.reviewer is not None and self.reviewer.enabled and self.reviewer.budget_left("checks"):
            self.reviewer.submit("check", alert, self._after_review)
            return True
        return self._send(alert)

    def _send(self, alert: Alert) -> bool:
        tag = "🤖✨" if alert.ai_find else ("🔥" if alert.score.is_top else "🆕")
        log.info("%s %s – %.2f € (Score %s)%s", tag, alert.item.title, alert.item.price, alert.score.total,
                 f" · KI: {alert.ai.urteil}" if alert.ai else "")
        ok = bool(self.notifier.send_alert(alert))
        if ok:
            with self._lock:
                self.stats["alerts"] += 1
                if alert.worker:
                    self.stats["workers"].setdefault(alert.worker, {"cycles": 0, "checked": 0, "alerts": 0})
                    self.stats["workers"][alert.worker]["alerts"] += 1
        return ok

    def _after_review(self, kind: str, alert: Alert) -> None:
        """Läuft im KI-Thread: Urteil holen, Fakes aussortieren, KI-Funde melden."""
        from .vision import listing_context
        if kind == "check":
            verdict = self.reviewer.review(alert.item, listing_context(alert.item, alert))
            if verdict is not None:
                alert.ai = verdict
                with self._lock:
                    self.stats["ai_checked"] += 1
                if verdict.fake and self.cfg.ai_hide_fakes:
                    log.info("🤖 Fake-Verdacht, nicht gemeldet: %s (%s)", alert.item.title,
                             "; ".join(verdict.echtheit_gruende))
                    with self._lock:
                        self.stats["ai_fakes"] += 1
                    return
            self._send(alert)
            return
        # Zweitblick: knapp verpasstes Retro-/Trend-Teil – sieht die KI mehr Wert als die Faustregel?
        verdict = self.reviewer.review(alert.item, listing_context(alert.item, alert), kind="second_looks")
        if verdict is None or verdict.fake or verdict.urteil == "lassen" or verdict.look < 6 or not verdict.wert_eur:
            return
        value = verdict.wert_eur
        profit = value - (alert.item.total_price or alert.item.price) - self.cfg.shipping_estimate
        discount = 1 - alert.item.price / value
        targets = self.resale_targets()
        if discount * 100 < targets["min_discount"] or profit < targets["min_profit"]:
            return
        if not self.storage.claim_alert(alert.item.id):
            return
        self.storage.save_item(alert.item, alert.ptype)
        alert.ai, alert.ai_find = verdict, True
        alert.score.value, alert.score.discount, alert.score.profit = value, discount, profit
        alert.score.reasons.insert(0, f"🤖 KI schätzt den Wert auf ca. {value:.0f} € – mehr als die Faustregel")
        with self._lock:
            self.stats["ai_finds"] += 1
        if not self.paused:
            self._send(alert)

    def _maybe_second_look(self, search: SearchConfig, item: Item, score: Any, why: str, rare: Any,
                           trend: Optional[str], ptype: str, kind: str) -> None:
        """Knapp verpasste Retro-/Trend-Teile der KI zeigen – Faustregeln unterschätzen solche Teile oft."""
        r = self.reviewer
        if (r is None or not self.cfg.ai_second_look or kind != "new" or not search.is_resale
                or not r.enabled or not r.budget_left("second_looks") or score.fake_suspect):
            return
        if not why.startswith(("Rabatt zu klein", "Gewinn zu klein", "nicht günstig genug")):
            return
        if not (rare.level or trend or is_retro(item.title)) or (score.discount or 0) < 0.15:
            return
        if self.storage.get_state(f"sl:{item.id}"):
            return
        self.storage.set_state(f"sl:{item.id}", "1")
        alert = Alert(item=item, search_name=search.name, score=score, buy_url=item.buy_url(self.cfg.web_base),
                      resale=True, ptype=ptype, offers=suggest_offers(item.price, self.cfg.offer_discounts))
        r.submit("second_look", alert, self._after_review)

    # -- Ein Durchlauf (Tests, Probelauf) ---------------------------------------------

    def run_once(self) -> int:
        """Ein Durchlauf über alle aktiven Suchen (ohne Parallelität). Gibt die Zahl der Meldungen zurück."""
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
                self._error(f"{search.name}: {e}")
                alerts = []
            for alert in alerts:
                if self._deliver(alert):
                    sent += 1
            if i < len(searches) - 1:
                self.stop_event.wait(random.uniform(*self.pause_between_searches))
        with self._lock:
            self.stats["cycles"] += 1
            self.stats["last_cycle"] = self.clock()
        return sent

    def _error(self, text: str) -> None:
        with self._lock:
            self.stats["errors"] += 1
            self.stats["last_error"] = text
        log.warning("Suche fehlgeschlagen: %s", text)

    # -- Dauerbetrieb: mehrere Sucher, abwechselnd getaktet ---------------------------

    def run_forever(self, client_factory: Optional[Callable[[], Any]] = None) -> None:
        n = max(1, int(self.cfg.workers))
        factory = client_factory or (lambda: VintedClient(self.cfg.domain, proxy=self.cfg.proxy))
        self.pacer = Pacer(self.cfg.request_gap_seconds)
        threads = []
        for idx in range(n):
            client = self.client if idx == 0 else factory()
            t = threading.Thread(target=self._worker, args=(idx, n, client), name=f"Sucher-{chr(65 + idx)}",
                                 daemon=True)
            threads.append(t)
            t.start()
        if self.reviewer is not None:
            self.reviewer.start()
        last_cleanup = 0.0
        while not self.stop_event.is_set():
            if time.time() - last_cleanup > 86400:
                self.storage.cleanup()
                last_cleanup = time.time()
            self.stop_event.wait(5)
        for t in threads:
            t.join(timeout=15)
        if self.reviewer is not None:
            self.reviewer.stop()

    def _worker(self, idx: int, n: int, client: Any) -> None:
        letter = chr(65 + idx)
        backoff = 0.0
        with self._lock:
            self.stats["workers"].setdefault(letter, {"cycles": 0, "checked": 0, "alerts": 0})
        self.stop_event.wait(idx * self.cfg.request_gap_seconds)  # versetzt starten: A, dann B, …
        while not self.stop_event.is_set():
            started = time.monotonic()
            mine = [s for i, s in enumerate(self.active_searches()) if i % n == idx]
            for search in mine:
                if not self.pacer.wait(self.stop_event):
                    return
                try:
                    alerts = self.check_search(search, client=client, worker=letter)
                    backoff = 0.0
                    self._unblocked()
                except VintedRateLimited as e:
                    pause = max(60.0, e.retry_after)
                    self.pacer.pause(pause)
                    log.warning("Zu viele Anfragen – alle Sucher pausieren %.0f s.", pause)
                    continue
                except VintedBlocked as e:
                    backoff = min(900.0, backoff * 2 if backoff else 60.0)
                    self.pacer.pause(backoff)
                    self._error(str(e))
                    self._blocked(e)
                    continue
                except Exception as e:  # noqa: BLE001
                    self._error(f"{search.name}: {e}")
                    continue
                for alert in alerts:
                    self._deliver(alert, worker=letter)
            with self._lock:
                self.stats["cycles"] += 1
                w = self.stats["workers"][letter]
                w["cycles"] += 1
                self.stats["last_cycle"] = self.clock()
            log.info("Runde %d fertig: %d Suchen in %.0f s · bisher %d Artikel geprüft, %d Meldung(en)",
                     w["cycles"], len(mine), time.monotonic() - started, w["checked"], w["alerts"])
            interval = self.cfg.interval_seconds
            self.stop_event.wait(max(self.min_cycle_wait, interval + random.uniform(0, interval * 0.2)
                                     - (time.monotonic() - started)))

    def _blocked(self, e: Exception) -> None:
        with self._lock:
            first = not self._blocked_notified
            self._blocked_notified = True
        log.warning("%s Alle Sucher machen eine Pause.", e)
        if first:
            self.notifier.send_text(f"⚠️ {e}\nIch versuche es automatisch weiter. Wenn das oft passiert: "
                                    "weniger Sucher (vinted → workers) oder größeren Abstand (request_gap_seconds).")

    def _unblocked(self) -> None:
        with self._lock:
            was = self._blocked_notified
            self._blocked_notified = False
        if was:
            self.notifier.send_text("✅ Vinted antwortet wieder – die Suche läuft weiter.")

    def stop(self) -> None:
        self.stop_event.set()
        if self.reviewer is not None:
            self.reviewer.stop()


class Pacer:
    """Taktgeber: Zwischen zwei Vinted-Anfragen (aller Sucher zusammen) liegt mindestens `gap` Sekunden.
    Die Sucher nehmen sich der Reihe nach den nächsten freien Zeitpunkt – so wechseln sie sich ab: A, B, A, B …"""

    def __init__(self, gap: float):
        self.gap = gap
        self._lock = threading.Lock()
        self._next = 0.0
        self._pause_until = 0.0

    def wait(self, stop_event: threading.Event) -> bool:
        while not stop_event.is_set():
            with self._lock:
                now = time.monotonic()
                slot = max(now, self._next, self._pause_until)
                self._next = slot + self.gap * random.uniform(0.8, 1.25)
            delay = slot - time.monotonic()
            if delay > 0 and stop_event.wait(delay):
                return False
            with self._lock:
                if time.monotonic() >= self._pause_until:
                    return True
        return False

    def pause(self, seconds: float) -> None:
        with self._lock:
            self._pause_until = max(self._pause_until, time.monotonic() + seconds)
