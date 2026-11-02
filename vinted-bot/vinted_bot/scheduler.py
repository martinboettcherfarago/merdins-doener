"""Takt pro Suche: Wer ist als Nächstes dran?

Statt alle Suchen stur der Reihe nach abzuarbeiten (eine Runde dauert dann 1–2 Minuten), bekommt jede Suche
ihr eigenes Tempo – je mehr bei ihr hochgeladen wird, desto öfter wird sie geprüft:

  ⚡ Sniper (neueste Uploads auf ganz Vinted)   alle ~4 s
  viel los (z. B. Nike, Adidas, Carhartt)       alle ~10–25 s
  wenig los (z. B. Vivienne Westwood)           alle 1–2 Min.

So kommen auch Marken-Treffer nach Sekunden statt nach Minuten – bei gleich vielen Anfragen an Vinted.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class Slot:
    interval: float
    due: float
    last_poll: Optional[float] = None
    rate: Optional[float] = None       # neue Artikel pro Sekunde (geglättet)
    busy: bool = False
    polls: int = 0


class Scheduler:
    def __init__(self, fast_gap: float = 4.0, min_gap: float = 8.0, max_gap: float = 180.0,
                 target_new: float = 10.0, stagger: float = 1.0, first_gap: float = 30.0):
        self.fast_gap = fast_gap        # Sniper
        self.min_gap = min_gap          # schnellster Takt einer Marken-Suche
        self.max_gap = max_gap          # langsamster Takt
        self.target_new = target_new    # so viele neue Artikel sollen sich zwischen zwei Blicken ansammeln
        self.stagger = stagger          # neue Suchen nacheinander starten
        self.first_gap = first_gap      # Takt, bis das Tempo einer Suche gemessen ist
        self._lock = threading.Lock()
        self._slots: dict[str, Slot] = {}

    def take(self, searches: list[Any], now: float) -> tuple[Optional[Any], float]:
        """Die dringendste fällige Suche (wird für diesen Sucher reserviert) – oder None und wie lange bis
        zur nächsten. Vorrang hat, wer gemessen an seinem Takt am längsten überfällig ist."""
        with self._lock:
            start = now
            for s in searches:
                if s.name not in self._slots:
                    first = self.fast_gap if s.sweep else min(self.max_gap, self.first_gap)
                    self._slots[s.name] = Slot(interval=first, due=now if s.sweep else start)
                    start += 0 if s.sweep else self.stagger
            best, best_key, soonest = None, None, self.max_gap
            for s in searches:
                slot = self._slots[s.name]
                if slot.busy:
                    continue
                if slot.due > now:
                    soonest = min(soonest, slot.due - now)
                    continue
                key = (now - slot.due) / slot.interval + (1.0 if s.sweep else 0.0)
                if best_key is None or key > best_key:
                    best, best_key = s, key
            if best is not None:
                self._slots[best.name].busy = True
                return best, 0.0
            return None, soonest

    def done(self, search: Any, fresh: int, full_gap: bool, seeded: bool, now: float) -> float:
        """Nach einer Abfrage: Tempo anhand der neuen Artikel anpassen. Gibt den neuen Takt zurück."""
        with self._lock:
            slot = self._slots.setdefault(search.name, Slot(interval=30.0, due=now))
            if search.sweep:
                interval = self.fast_gap
            elif slot.last_poll is not None and seeded:
                rate = fresh / max(1e-3, now - slot.last_poll)
                slot.rate = rate if slot.rate is None else 0.5 * slot.rate + 0.5 * rate
                interval = self.target_new / max(slot.rate, 1e-4)
                if full_gap:  # eine ganze Seite neu -> wir waren zu langsam
                    interval = self.min_gap
                interval = max(self.min_gap, min(self.max_gap, interval))
            else:
                interval = slot.interval
            slot.interval, slot.last_poll, slot.busy = interval, now, False
            slot.due = now + interval
            slot.polls += 1
            return interval

    def release(self, name: str, now: float, delay: Optional[float] = None) -> None:
        """Abfrage fehlgeschlagen: später nochmal."""
        with self._lock:
            slot = self._slots.get(name)
            if slot is not None:
                slot.busy = False
                slot.due = now + (delay if delay is not None else slot.interval)

    def tempo(self) -> list[tuple[str, float]]:
        """(Suche, Takt in s) – schnellste zuerst."""
        with self._lock:
            return sorted(((n, s.interval) for n, s in self._slots.items() if s.polls), key=lambda x: x[1])
