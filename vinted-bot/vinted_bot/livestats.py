"""📈 Live-Check: misst, was wirklich reinkommt – wie oft, wie frisch, wie teuer, und warum der Rest rausfliegt.

Per Telegram: /live (letzte Stunde) · /live 10 (letzte 10 Minuten).
"""

from __future__ import annotations

import re
import threading
import time
from collections import Counter, deque
from statistics import median
from typing import Any, Optional

_SIZE = re.compile(r"^Größe .* passt nicht$")
_OLD = re.compile(r"^schon \d+ Min\. online$")


def reason_key(why: str) -> str:
    """'Größe XL passt nicht (S, M, L)' -> 'Größe passt nicht' (für die Statistik)."""
    key = why.split(" (")[0].split(":")[0].strip()
    if _SIZE.match(key):
        return "Größe passt nicht"
    if _OLD.match(key):
        return "schon zu lange online"
    if key.startswith("Ausschlusswort"):
        return "Ausschlusswort (fake, defekt, suche …)"
    if key.startswith("Foto zeigt"):
        return "Foto zeigt Kleinkram"
    return key or "?"


def _eur(value: float) -> str:
    return f"{value:,.0f} €".replace(",", ".")


class LiveStats:
    def __init__(self) -> None:
        self.started = time.time()
        self._lock = threading.Lock()
        self.polls: deque[tuple[float, int, bool]] = deque(maxlen=20000)       # (Zeit, neue Artikel, Sniper?)
        self.alerts: deque[tuple[float, Optional[float], float, str, bool]] = deque(maxlen=2000)
        self.rejects: deque[tuple[float, str]] = deque(maxlen=100000)          # (Zeit, Grund)

    def poll(self, fresh: int, sniper: bool, now: Optional[float] = None) -> None:
        with self._lock:
            self.polls.append((now or time.time(), fresh, sniper))

    def reject(self, why: str, now: Optional[float] = None) -> None:
        with self._lock:
            self.rejects.append((now or time.time(), reason_key(why)))

    def alert(self, alert: Any, now: Optional[float] = None) -> None:
        now = now or time.time()
        created = alert.item.created_ts
        age = max(0.0, now - created) if created else None
        sniper = "Sniper" in (alert.search_name or "") or alert.worker == "Sniper"
        with self._lock:
            self.alerts.append((now, age, float(alert.item.price), alert.item.brand or "", sniper))

    def summary(self, minutes: float = 60, now: Optional[float] = None) -> dict[str, Any]:
        now = now or time.time()
        since = now - minutes * 60
        with self._lock:
            polls = [p for p in self.polls if p[0] >= since]
            alerts = [a for a in self.alerts if a[0] >= since]
            rejects = [r for r in self.rejects if r[0] >= since]
        sniper = sorted(p[0] for p in polls if p[2])
        gaps = [b - a for a, b in zip(sniper, sniper[1:])]
        ages = sorted(a[1] for a in alerts if a[1] is not None)
        prices = sorted(a[2] for a in alerts)
        sent = sorted(a[0] for a in alerts)
        return {
            "minutes": minutes,
            "sniper_polls": len(sniper),
            "sniper_gap": median(gaps) if gaps else None,
            "sniper_new": (sum(p[1] for p in polls if p[2]) / len(sniper)) if sniper else None,
            "brand_polls": sum(1 for p in polls if not p[2]),
            "checked": sum(p[1] for p in polls),
            "alerts": len(alerts),
            "from_sniper": sum(1 for a in alerts if a[4]),
            "last_alert": (now - sent[-1]) if sent else None,
            "alert_gap": ((sent[-1] - sent[0]) / (len(sent) - 1)) if len(sent) > 1 else None,
            "age_median": median(ages) if ages else None,
            "age_p90": ages[int(0.9 * (len(ages) - 1))] if ages else None,
            "price_median": median(prices) if prices else None,
            "share_20": (sum(1 for p in prices if p <= 20) / len(prices)) if prices else None,
            "max": max(alerts, key=lambda a: a[2]) if alerts else None,
            "reasons": Counter(r[1] for r in rejects).most_common(5),
            "rejected": len(rejects),
        }

    def text(self, minutes: float = 60, now: Optional[float] = None, level: str = "") -> str:
        now = now or time.time()
        s = self.summary(minutes, now)
        span = f"{minutes:g} Min." if minutes < 120 else f"{minutes / 60:g} Std."
        running = (now - self.started) / 60
        lines = [f"📈 <b>Live-Check – letzte {span}</b>"
                 + (f" (Bot läuft erst seit {running:.0f} Min.)" if running < minutes else "")]
        if s["sniper_polls"]:
            lines.append(f"⚡ Sniper: {s['sniper_polls']} Abfragen · alle ~{s['sniper_gap'] or 0:.0f} s · "
                         f"Ø {s['sniper_new']:.0f} neue Artikel pro Abfrage")
            if (s["sniper_gap"] or 0) > 20:
                lines.append("⚠️ Der Sniper fragt zu selten ab (Soll: alle ~4–6 s). Ist der PC stark ausgelastet "
                             "oder blockt Vinted? Im Fenster nach Warnungen schauen.")
        else:
            lines.append("⚡ Sniper: keine Abfragen (aus? → /radar an)")
        lines.append(f"🔎 Marken-Suchen: {s['brand_polls']} Abfragen · insgesamt {s['checked']} neue Artikel geprüft")
        if s["alerts"]:
            last = s["last_alert"]
            lines.append(f"📬 <b>{s['alerts']} Meldungen</b> ({s['from_sniper']} vom Sniper) · zuletzt vor "
                         + (f"{last:.0f} s" if last < 120 else f"{last / 60:.0f} Min.")
                         + (f" · im Schnitt alle {s['alert_gap'] / 60:.1f} Min." if s["alert_gap"] else ""))
            if s["age_median"] is not None:
                lines.append(f"⏱ Beim Melden erst {s['age_median']:.0f} s online (90 % unter {s['age_p90']:.0f} s)")
            top = s["max"]
            lines.append(f"💶 Preise: Median {_eur(s['price_median'])} · {s['share_20']:.0%} bis 20 € · "
                         f"teuerstes {_eur(top[2])}" + (f" ({top[3]})" if top[3] else ""))
        else:
            lines.append("📬 Noch keine Meldungen in diesem Zeitraum.")
        if s["reasons"]:
            total = max(1, s["rejected"])
            lines.append("❌ Aussortiert, meist wegen: " + " · ".join(f"{k} {n / total:.0%}" for k, n in s["reasons"]))
        if level:
            lines.append(f"🎚 Stufe: {level}")
        return "\n".join(lines)
