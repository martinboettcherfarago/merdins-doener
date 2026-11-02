"""Die Überwachungsschleife: Suchen abfragen, neue Artikel bewerten, Benachrichtigungen schicken."""

from __future__ import annotations

import logging
import math
import random
import threading
import time
from dataclasses import replace
from typing import Any, Callable, Optional

from .catalog import brand_info, hidden_label, is_kids, is_retro, type_hidden
from . import fakecheck
from .config import RESALE_LEVELS, RESALE_TARGET_KEYS, TREND_WATCHES, Config, SearchConfig, watch_name
from .knowledge import brand_key, estimate_item, rarity, size_matches, trend_match
from .models import Item
from .notify import Alert
from .scoring import (TYPE_LABELS, Reference, market_reference, meets_targets, normalize, passes_filters,
                      price_group, product_type, score_item, suggest_offers)
from .scheduler import Scheduler
from .storage import Storage
from .vinted import VintedBlocked, VintedClient, VintedRateLimited, query_for_search

log = logging.getLogger(__name__)

JUNK_TYPES = {"kleinkram", "verpackung"}   # Patches, Sticker, Kartons, Staubbeutel …
MEDIA_TYPES = {"buch", "medien"}           # Bücher, Magazine, Kataloge, CDs …
EXPENSIVE_TIERS = ("luxus", "designer", "outdoor")  # "wirklich teure Marken" dürfen übers Budget
WANTED_TIERS = ("premium", "streetwear", "outdoor", "designer", "luxus")  # meldet der Sniper immer
SNIPER = "⚡ Sniper"
# Beispiel-Suchen aus der alten config.example.yaml (werden einmalig pausiert, siehe _pause_example_searches)
EXAMPLE_SEARCHES = {"Air Max 90": ("nike air max 90", 60.0), "Carhartt Jacken": ("carhartt%20jacke", 70.0)}


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
        self.brain: Any = None      # eigenes Bildmodell (brain.Brain), wird von __main__ gesetzt
        self.pacer = Pacer(0.0)
        self.reject_log: Optional[list[tuple[str, Item, str]]] = None  # für Probelauf/Fehlersuche
        self._migrate_old_resale_searches()
        self._rename_old_searches()
        self._apply_trend_presets()
        self.paused_examples = self._pause_example_searches()
        self.min_cycle_wait = 3.0
        self.last_fetch: dict[str, tuple[int, int]] = {}   # Suche -> (neue Artikel, Artikel insgesamt)
        self.sniper_stats = {"polls": 0, "new": 0, "gaps": 0, "alerts": 0, "since": time.monotonic()}
        self.scheduler = Scheduler()
        self.scheduler_settings: Optional[dict[str, float]] = None   # Tests: schnellere Takte
        self._last_report = time.monotonic()
        self._brand_cache: tuple[float, set[str]] = (0.0, set())

    def _pause_example_searches(self) -> list[str]:
        """Die Beispiel-Suchen der alten Vorlage ("Air Max 90", "Carhartt Jacken") melden alles mögliche ohne
        Rabatt-Prüfung. Einmalig pausieren – mit /weiter jederzeit wieder einschaltbar."""
        if self.storage.get_state("migrated:examples_v1") == "1":
            return []
        paused = []
        for s in self.cfg.searches:
            ex = EXAMPLE_SEARCHES.get(s.name)
            if ex and s.source == "config" and s.max_price == ex[1] and \
                    ex[0] in ((s.keywords or "") + " " + (s.url or "")).lower():
                self.storage.set_disabled(s.name, True)
                paused.append(s.name)
        self.storage.set_state("migrated:examples_v1", "1")
        return paused

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
        """Suche mit den Zielen der Schnäppchen-Stufe und deinem Budget (gilt nur fürs Schnäppchen-Radar)."""
        s = search.with_targets(self.resale_targets())
        if s.is_resale:
            cap = self.search_cap(s)
            # eigene Grenze per Telegram (/marke stone island bis 300) gilt; sonst höchstens das Budget
            if s.max_price is None or (s.max_price > cap and s.source != "telegram"):
                s = replace(s, max_price=cap)
        return s

    # -- Budget: günstige Teile, nur teure Marken dürfen mehr kosten ----------------------

    def budget(self) -> tuple[float, float]:
        """(normales Budget, Budget für teure Marken) – per /budget änderbar, sonst aus der config."""
        def _num(key: str, default: float) -> float:
            try:
                return float(self.storage.get_state(key) or default)
            except ValueError:
                return default
        normal = _num("budget", self.cfg.budget)
        return normal, max(normal, _num("budget_brands", self.cfg.budget_brands))

    def price_cap(self, tier: Optional[str]) -> float:
        normal, brands = self.budget()
        return brands if tier in EXPENSIVE_TIERS else normal

    def search_cap(self, search: SearchConfig) -> float:
        """Preis-Obergrenze der Vinted-Abfrage: teure Marken-Suchen (Stone Island, Arc'teryx …) dürfen höher."""
        if search.sweep or not search.brands:
            return self.budget()[0]
        info = brand_info(search.brands[0])
        return self.price_cap(info[1] if info else None)

    # -- ⚡ Sniper: die neuesten Uploads auf ganz Vinted, alle paar Sekunden -------------

    def watched_brands(self) -> set[str]:
        """Marken deiner Schnäppchen-Suchen (Trend-Liste + eigene), kurz zwischengespeichert."""
        ts, keys = self._brand_cache
        if time.monotonic() - ts < 30:
            return keys
        keys = {brand_key(b) for s in self.active_searches() if s.is_resale for b in s.brands} - {""}
        self._brand_cache = (time.monotonic(), keys)
        return keys

    def _wanted_brand(self, est: Any) -> bool:
        """Der Sniper meldet Marken aus deiner Liste und gefragte Premium-Marken – kein No-Name/Fast Fashion."""
        return est.tier in WANTED_TIERS or (bool(est.brand) and brand_key(est.brand) in self.watched_brands())

    def matching_watch(self, item: Item, est: Any) -> Optional[SearchConfig]:
        """Die genaueste Schnäppchen-Suche mit eigenen Einstellungen, zu der dieses Teil passt
        (z. B. "Vintage Adidas" mit 35 % statt 40 % oder "/marke stone island rabatt 60")."""
        haystack = normalize(f"{item.title} {item.brand}")
        brand = brand_key(est.brand or item.brand)
        best, best_rank = None, -1
        for w in self.active_searches():
            if not w.is_resale or w.sweep:
                continue
            if all(getattr(w, k) is None for k in RESALE_TARGET_KEYS) and not w.exclude_words and not w.sizes:
                continue  # nichts Besonderes eingestellt -> Stufe gilt sowieso
            keys = {brand_key(b) for b in w.brands} - {""}
            if keys and brand not in keys:
                continue
            words = [normalize(x) for x in (w.keywords or "").split()]
            words = [x for x in words if x and x not in keys and not any(x in k for k in keys)]
            if not all(x in haystack for x in words):
                continue
            rank = len(words) + (1 if keys else 0)
            if rank > best_rank:
                best, best_rank = w, rank
        return best

    def _sniper_rules(self, search: SearchConfig, item: Item, est: Any) -> tuple[SearchConfig, str]:
        w = self.matching_watch(item, est)
        if w is None:
            return search, ""
        merged = replace(search, exclude_words=search.exclude_words + w.exclude_words, sizes=w.sizes or search.sizes,
                         **{k: getattr(w, k) for k in RESALE_TARGET_KEYS if getattr(w, k) is not None})
        if w.exclude_words or w.sizes:
            ok, why = passes_filters(item, merged, self.cfg.global_exclude_words)
            if not ok:
                return merged, why
        return merged, ""

    def sniper_enabled(self) -> bool:
        state = self.storage.get_state("sniper")
        return state == "1" if state in ("0", "1") else self.cfg.sniper

    def sniper_search(self) -> SearchConfig:
        url = self.storage.get_state("sniper_url") or next(
            (s.url for s in self.all_searches() if s.sweep and s.url and s.enabled), None)
        return self.effective(SearchConfig(name=SNIPER, sweep=True, mode="resale", url=url, source="sniper"))

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
        """Die Suchen der normalen Sucher (das Alles-Radar läuft als ⚡ Sniper auf der Überholspur)."""
        return [s for s in self.all_searches() if s.enabled and not s.sweep and not self.storage.is_disabled(s.name)]

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
        if self.brain is not None:     # … und das eigene Modell auch
            self.brain.label_like(item_id, positive)
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
        if search.is_resale and search.max_price is not None and item.price > search.max_price:
            return None, f"über deinem Budget ({search.max_price:.0f} €)"
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
        if search.sweep:  # Sniper: für dieses Teil gelten die Einstellungen deiner passenden Marken-/Trend-Suche
            search, why = self._sniper_rules(search, item, est)
            if why:
                return None, why
        use_brain = extra is None and self.brain is not None and self.brain.enabled and kind == "new"
        view = None
        if use_brain and ptype == "sonstiges":
            # Titel verrät die Kategorie nicht ("Adidas Firebird", "Carhartt Detroit") -> das Foto fragen.
            # So greifen auch Größen-/Kategorie-Filter (z. B. Schuhe ausgeblendet) und die Preisschätzung.
            view = self.brain.assess(item, ptype, est)
            seen = view.tag("kategorie", 0.6) if view is not None else None
            if seen is not None and seen.ptype and seen.ptype not in JUNK_TYPES | MEDIA_TYPES:
                ptype = seen.ptype
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
            if search.sweep and not rare.level and not trend and not self._wanted_brand(est):
                return None, "Sniper: keine Marke aus deiner Liste"

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
        # Foto nur für echte Kandidaten laden & bewerten (hält den Sniper schnell); das Modell darf
        # aber Teile retten, die laut Faustregel nur knapp unter Wert liegen
        if use_brain and (view is not None or (score.discount or 0) >= 0.1 or rare.level or trend):
            if view is None:
                view = self.brain.assess(item, ptype, est)
            if view is not None:
                # Das Mode-Bildmodell erkennt Kleinkram auch dann, wenn der Titel nichts verrät
                seen = view.tag("kategorie", 0.6)
                no_clothes = JUNK_TYPES | MEDIA_TYPES
                if seen is not None and seen.ptype in no_clothes and ptype not in no_clothes \
                        and self._junk_reason(search, item, seen.ptype):
                    return None, f"Foto zeigt {seen.label} ({seen.prob:.0%}) – kein Kleidungsstück"
                if view.fake is not None and view.fake >= 0.75 and self.ampel_mode() == "aus":
                    return None, f"eigenes Modell: Fake-Risiko {view.fake:.0%}"
                bonus = 0.0
                if view.popular is not None:
                    bonus += (view.popular - 0.5) * 10
                if view.taste is not None:
                    bonus += (view.taste - 0.5) * 16
                adjusted = ref
                if view.value and view.value_trusted and ref.price and score.value:
                    # gelernter Wert und Faustregel mischen (das Modell zählt mehr, wenn es besser ist)
                    blended = math.exp(0.6 * math.log(view.value) + 0.4 * math.log(score.value))
                    adjusted = Reference(ref.price * blended / score.value, ref.basis + " + eigenes Modell",
                                         ref.samples, ref.prices)
                if bonus or adjusted is not ref:
                    score = score_item(item, adjusted, self.cfg.top_deal_score, now, resale=search.is_resale,
                                       shipping=self.cfg.shipping_estimate, rare=rare,
                                       pref_pts=max(-20.0, min(20.0, pref_pts + bonus)), est=est, trend=trend)
        if kind == "price_drop" and old_price:
            score.reasons.insert(0, f"Preis um {1 - item.price / old_price:.0%} gesenkt")
        ampel = None
        if self.ampel_mode() != "aus":
            ampel = fakecheck.check(item, est.brand or "", ptype, score.discount, est.tier,
                                    tags=view.tags if view is not None else None,
                                    model_fake=view.fake if view is not None else None)
            if ampel.level == "rot" and self.ampel_mode() == "streng" and not self._ai_can_check():
                return None, f"Fake-Ampel rot ({ampel.risk:.0%}: {'; '.join(ampel.reasons[:2])})"
        ok, why = self._meets_targets_with_model(search, score, view, rare)
        if not ok:
            if extra is None and (ampel is None or ampel.level == "grün"):
                self._maybe_second_look(search, item, score, why, rare, trend, ptype, kind,
                                        photo_cool=view is not None and view.is_cool)
            return None, why
        return Alert(item=item, search_name=search.name, score=score, buy_url=item.buy_url(self.cfg.web_base),
                     kind=kind, old_price=old_price, resale=search.is_resale, ptype=ptype, brain=view,
                     ampel=ampel, offers=suggest_offers(item.price, self.cfg.offer_discounts)), ""

    def _meets_targets_with_model(self, search: SearchConfig, score: Any, view: Any, rare: Any) -> tuple[bool, str]:
        """Ziele der Suche – mit Bildmodell etwas lockerer für coole/passende Teile, strenger für unpassende.

        Cooler Foto-Look (90er, Sportswear, Fellkragen …), "passt zu deinem Geschmack" und "sieht begehrt aus"
        senken den nötigen Rabatt (zusammen um höchstens 15 Punkte, nie unter 25 %). Was laut Geschmacks-Modell
        gar nicht zu dir passt, braucht 10 Punkte mehr Rabatt."""
        relax, notes = 0.0, []
        if view is not None and search.is_resale and search.min_discount is not None:
            if view.is_cool and not rare.level:
                relax += 10
                notes.append(f"😎 Foto-Look: {' · '.join(view.cool_bits[:3])}")
            if view.taste is not None and view.taste >= 0.7:
                relax += 10
                notes.append(f"😍 passt zu deinem Geschmack ({view.taste:.0%})")
            elif view.taste is not None and view.taste <= 0.25:
                relax -= 10
            if view.popular is not None and view.popular_trusted and view.popular >= 0.75:
                relax += 5
                notes.append(f"🔥 sieht begehrt aus ({view.popular:.0%})")
            relax = max(-10.0, min(15.0, relax))
        if not relax:
            ok, why = meets_targets(search, score)
            if ok and notes:
                score.reasons.insert(0, " · ".join(notes))
            return ok, why
        needed = search.min_discount - relax
        adjusted = replace(search, min_discount=max(25.0, needed) if relax > 0 else needed,
                           min_cheaper_than=None if search.min_cheaper_than is None
                           else max(50.0, min(99.0, search.min_cheaper_than - relax)))
        ok, why = meets_targets(adjusted, score)
        plain_ok = meets_targets(search, score)[0]
        if ok and notes:
            hint = (f" → dafür reichen {adjusted.min_discount:.0f} % statt {search.min_discount:.0f} % Rabatt"
                     if not plain_ok else "")
            score.reasons.insert(0, " · ".join(notes) + hint)
        elif not ok and plain_ok:
            why = f"passt laut Geschmacks-Modell eher nicht zu dir ({view.taste:.0%}) – bräuchte mehr Rabatt"
        return ok, why

    def ampel_mode(self) -> str:
        """streng / warnen / aus – per /ampel änderbar, sonst aus der config."""
        mode = self.storage.get_state("fake_ampel")
        return mode if mode in ("streng", "warnen", "aus") else self.cfg.fake_ampel

    def _ai_can_check(self) -> bool:
        r = self.reviewer
        return r is not None and r.enabled and r.budget_left("checks")

    def check_search(self, search: SearchConfig, client: Any = None, worker: str = "", page: int = 1) -> list[Alert]:
        """Fragt eine Suche ab und liefert die Treffer, die gemeldet werden sollen."""
        search = self.effective(search)
        query, per_page = query_for_search(search, self.cfg.currency), self._per_page(search)
        c = client or self.client
        items = c.search(query, per_page=per_page, page=page) if page > 1 else c.search(query, per_page=per_page)
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
        fresh = 0
        for item in items:
            prev = self.storage.seen_price(search.name, item.id)
            alert = None
            if prev is None:
                fresh += 1
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
                    if self.brain is not None:  # Trainingsdaten fürs eigene Modell
                        ptype_c = product_type(item.title)
                        self.brain.collect(item, ptype_c, estimate_item(item, ptype_c))
            else:
                if self.brain is not None:
                    self.brain.seen_again(item)  # Favoriten-Verlauf fürs Begehrt-Modell
                if item.price == prev:
                    continue
                self.storage.mark_seen(search.name, item)
                if item.price <= prev * drop_factor:
                    alert = self.evaluate(search, item, now, "price_drop", prev)
            if alert:
                alerts.append(alert)

        with self._lock:
            self.last_fetch[search.name] = (fresh, len(items))
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
        if self._ai_can_check():
            self.reviewer.submit("check", alert, self._after_review)
            return True
        if self._ampel_blocks(alert):  # rot, aber KI-Budget inzwischen aufgebraucht
            log.info("🛡 Fake-Ampel rot, nicht gemeldet: %s", alert.item.title)
            return False
        return self._send(alert)

    def _ampel_blocks(self, alert: Alert, verdict: Any = None) -> bool:
        """Rote Ampel im strengen Modus: nur melden, wenn Claude die Fotos geprüft hat und sie echt wirken."""
        if alert.ampel is None or alert.ampel.level != "rot" or self.ampel_mode() != "streng":
            return False
        return verdict is None or verdict.echtheit != "wahrscheinlich_echt"

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
                if self.brain is not None:
                    self.brain.label_ai(alert.item.id, verdict)  # Lehrer-Schüler: Claude bringt dem Modell bei
                with self._lock:
                    self.stats["ai_checked"] += 1
                if verdict.fake and self.cfg.ai_hide_fakes:
                    log.info("🤖 Fake-Verdacht, nicht gemeldet: %s (%s)", alert.item.title,
                             "; ".join(verdict.echtheit_gruende))
                    with self._lock:
                        self.stats["ai_fakes"] += 1
                    return
            if self._ampel_blocks(alert, verdict):
                log.info("🛡 Fake-Ampel rot und KI nicht überzeugt, nicht gemeldet: %s", alert.item.title)
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
                           trend: Optional[str], ptype: str, kind: str, photo_cool: bool = False) -> None:
        """Knapp verpasste Retro-/Trend-Teile der KI zeigen – Faustregeln unterschätzen solche Teile oft."""
        r = self.reviewer
        if (r is None or not self.cfg.ai_second_look or kind != "new" or not search.is_resale
                or not r.enabled or not r.budget_left("second_looks") or score.fake_suspect):
            return
        if not why.startswith(("Rabatt zu klein", "Gewinn zu klein", "nicht günstig genug")):
            return
        if not (rare.level or trend or is_retro(item.title) or photo_cool) or (score.discount or 0) < 0.15:
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
        self.scheduler = Scheduler(**(self.scheduler_settings or {
            "fast_gap": self.cfg.sniper_every_seconds, "stagger": self.cfg.request_gap_seconds,
            "max_gap": max(60.0, min(600.0, self.cfg.interval_seconds * 3.0))}))
        threads = []
        for idx in range(n):
            client = self.client if idx == 0 else factory()
            t = threading.Thread(target=self._worker, args=(idx, n, client), name=f"Sucher-{chr(65 + idx)}",
                                 daemon=True)
            threads.append(t)
            t.start()
        if self.reviewer is not None:
            self.reviewer.start()
        if self.brain is not None:
            self.brain.start()
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

    def scheduled_searches(self) -> list[SearchConfig]:
        """Alles, was die Sucher abfragen: ⚡ Sniper (falls an) + alle aktiven Marken-, Trend- und eigenen Suchen."""
        searches = list(self.active_searches())
        if self.sniper_enabled():
            searches.insert(0, self.sniper_search())
        return searches

    def _worker(self, idx: int, n: int, client: Any) -> None:
        """Ein Sucher: nimmt sich immer die dringendste Suche (eigener Takt pro Suche, siehe scheduler.py).
        Alle Sucher teilen sich den Taktgeber – die Zahl der Anfragen an Vinted bleibt gleich."""
        letter = chr(65 + idx)
        backoff = 0.0
        with self._lock:
            self.stats["workers"].setdefault(letter, {"cycles": 0, "polls": 0, "checked": 0, "alerts": 0})
        self.stop_event.wait(idx * self.cfg.request_gap_seconds)  # versetzt starten: A, dann B, …
        while not self.stop_event.is_set():
            search, wait = self.scheduler.take(self.scheduled_searches(), time.monotonic())
            if search is None:
                self.stop_event.wait(min(max(wait, 0.05), 1.0))
                continue
            label = "Sniper" if search.sweep else letter
            try:
                fresh, full_gap, seeded = self._poll(search, client, label)
                self.scheduler.done(search, fresh, full_gap, seeded, time.monotonic())
                backoff = 0.0
                self._unblocked()
            except VintedRateLimited as e:
                pause = max(60.0, e.retry_after)
                self.pacer.pause(pause)
                self.scheduler.release(search.name, time.monotonic(), pause)
                log.warning("Zu viele Anfragen – alle Sucher pausieren %.0f s.", pause)
                continue
            except VintedBlocked as e:
                backoff = min(900.0, backoff * 2 if backoff else 60.0)
                self.pacer.pause(backoff)
                self.scheduler.release(search.name, time.monotonic(), backoff)
                self._error(str(e))
                self._blocked(e)
                continue
            except Exception as e:  # noqa: BLE001
                self.scheduler.release(search.name, time.monotonic())
                self._error(f"{search.name}: {e}")
                continue
            with self._lock:
                w = self.stats["workers"][letter]
                w["polls"] += 1
                self.stats["polls"] = self.stats.get("polls", 0) + 1
                self.stats["last_cycle"] = self.clock()
                # "Runde" = so viele Abfragen, wie es Suchen gibt (für /status und die Tests)
                if w["polls"] % max(1, len(self.active_searches()) // n or 1) == 0:
                    w["cycles"] += 1
                    self.stats["cycles"] += 1
                report = time.monotonic() - self._last_report > 300
                if report:
                    self._last_report = time.monotonic()
            if report:
                self._report_tempo()

    def _poll(self, search: SearchConfig, client: Any, label: str) -> tuple[int, bool, bool]:
        """Eine Suche abfragen. Ist die ganze Seite neu, kam seit dem letzten Blick mehr rein – dann sofort
        weiterblättern (bis Seite 3), damit nichts durchrutscht. Gibt (neue Artikel, Lücke, war eingelernt)."""
        search = self.effective(search)
        seeded = self.storage.is_seeded(search.name)
        fresh_sum, full_gap = 0, False
        for page in (1, 2, 3):
            if not self.pacer.wait(self.stop_event):
                break
            alerts = self.check_search(search, client=client, worker=label, page=page)
            for alert in alerts:
                if self._deliver(alert, worker=label) and search.sweep:
                    self.sniper_stats["alerts"] += 1
            fresh, total = self.last_fetch.get(search.name, (0, 0))
            fresh_sum += fresh
            if search.sweep:
                self.sniper_stats["polls"] += 1
                self.sniper_stats["new"] += fresh
            if not seeded or total < self._per_page(search) or fresh < total:
                break  # Anschluss an den letzten Blick gefunden – nichts verpasst
            full_gap = page == 3
            if full_gap and search.sweep:
                self.sniper_stats["gaps"] += 1
        return fresh_sum, full_gap, seeded

    def _report_tempo(self) -> None:
        """Alle 5 Minuten im Fenster: wie oft welche Suche drankommt."""
        st = self.sniper_stats
        if st["polls"]:
            log.info("⚡ Sniper: %d Abfragen in 5 Min. · Ø %.0f neue Artikel pro Abfrage · %d Meldung(en)%s",
                     st["polls"], st["new"] / max(1, st["polls"]), st["alerts"],
                     f" · {st['gaps']}× sehr viel los (evtl. etwas verpasst)" if st["gaps"] else "")
        self.sniper_stats = {"polls": 0, "new": 0, "gaps": 0, "alerts": 0, "since": time.monotonic()}
        tempo = [(name, t) for name, t in self.scheduler.tempo() if name != SNIPER]
        if tempo:
            fast = " · ".join(f"{name.split(' · ', 1)[-1]} {t:.0f} s" for name, t in tempo[:5])
            log.info("⏱ Marken-Takt: %s … (%d Suchen, die ruhigsten alle %.0f s)", fast, len(tempo), tempo[-1][1])

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
        if self.brain is not None:
            self.brain.stop()

    def bootstrap(self, pages: int = 3, client: Any = None, done: Optional[Callable[[str], None]] = None) -> None:
        """Sammel-Turbo: tiefere Seiten aller Schnäppchen-Suchen durchgehen und Tausende Bilder auf einmal
        sammeln, danach sofort trainieren. Läuft im Hintergrund und hält den Takt der Sucher ein."""
        brain = self.brain
        if brain is None or not brain.enabled:
            return
        client = client or VintedClient(self.cfg.domain, proxy=self.cfg.proxy)
        queued = 0
        for search in [self.effective(s) for s in self.active_searches() if s.is_resale]:
            for page in range(1, pages + 1):
                if self.stop_event.is_set() or not self.pacer.wait(self.stop_event):
                    return
                try:
                    items = client.search(query_for_search(search, self.cfg.currency), per_page=96, page=page)
                except Exception as e:  # noqa: BLE001
                    log.info("Sammel-Turbo: %s Seite %d übersprungen (%s)", search.name, page, e)
                    break
                for item in items:
                    if self._learnable(search, item) and not brain.data.has(item.id):
                        ptype_c = product_type(item.title)
                        brain.collect_blocking(item, ptype_c, estimate_item(item, ptype_c))
                        queued += 1
                if len(items) < 96:
                    break
        log.info("Sammel-Turbo: %d Artikel eingesammelt – verarbeite Fotos …", queued)
        brain.drain()
        rep = brain.train()
        if done:
            done(f"🧲 Sammel-Turbo fertig: {queued} neue Artikel.\n" + rep.text())


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
