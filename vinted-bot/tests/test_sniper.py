"""⚡ Sniper (neueste Uploads alle paar Sekunden), Budget und pausierte Beispiel-Suchen."""

import threading
import time

from conftest import NOW, FakeNotifier, item
from test_telegram import FakeTelegram, msg
from vinted_bot.config import SearchConfig, config_from_dict
from vinted_bot.monitor import SNIPER, Monitor, Pacer
from vinted_bot.notify import age_text, telegram_caption
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController


def monitor(tmp_path, data=None, client=None):
    from conftest import FakeClient
    cfg = config_from_dict(data or {"resale": {"brands": ["Carhartt", "Stone Island"]}}, base_dir=str(tmp_path))
    return Monitor(cfg, client or FakeClient(), Storage(str(tmp_path / "s.db")), FakeNotifier(), clock=lambda: NOW)


# -- Budget -------------------------------------------------------------------------------------

def test_budget_caps_bargain_searches_but_lets_expensive_brands_cost_more(tmp_path):
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt", "Stone Island", "Arc'teryx"], "max_price": 250}})
    caps = {s.name: s.max_price for s in map(m.effective, m.active_searches())}
    assert caps["Marke · Carhartt"] == 30          # alte config mit max_price 250 -> trotzdem 30 €
    assert caps["Marke · Stone Island"] == 80 and caps["Marke · Arc'teryx"] == 80
    assert m.sniper_search().max_price == 30
    s = m.effective(SearchConfig.watch("Carhartt"))
    assert m.explain(s, item(1, 45, title="Carhartt Jacke", brand="Carhartt", size="M"), NOW) == \
        (None, "über deinem Budget (30 €)")
    # eigene Grenze per Telegram (/marke … bis 120) bleibt
    own = SearchConfig.watch("Carhartt", source="telegram", max_price=120)
    assert m.effective(own).max_price == 120


def test_budget_command(tmp_path):
    m = monitor(tmp_path)
    tg = FakeTelegram()
    ctl = TelegramController(tg, m, None)
    ctl.handle_update(msg("/budget 20"))
    assert m.budget() == (20, 80) and "bis 20 € pro Teil" in tg.texts()[-1]
    ctl.handle_update(msg("/budget marken 150"))
    assert m.budget() == (20, 150)
    ctl.handle_update(msg("/budget 25 100"))
    assert m.budget() == (25, 100)
    assert m.effective(SearchConfig.watch("Carhartt")).max_price == 25


# -- ⚡ Sniper ------------------------------------------------------------------------------------

class FeedClient:
    """Neueste Uploads: jede Abfrage liefert die nächsten Artikel (wie ein echter Vinted-Feed)."""

    def __init__(self, pages):
        self.pages, self.calls, self.lock = list(pages), [], threading.Lock()

    def search(self, query, per_page=48, page=1):
        with self.lock:
            self.calls.append((query.search_text, query.price_to, page))
            return self.pages.pop(0) if self.pages else []


def feed_item(i, price=9, title="Vintage Adidas Trainingsjacke 90er", seconds_old=8):
    it = item(i, price, title=title, brand="Adidas", size="M")
    it.created_ts = NOW - seconds_old
    return it


def run_sniper(m, client, until):
    m.pacer = Pacer(0.0)
    m.cfg.sniper_every_seconds = 0.01
    t = threading.Thread(target=m._sniper, args=(client,), daemon=True)
    t.start()
    deadline, tick = time.time() + 10, threading.Event()
    while time.time() < deadline and not until():
        tick.wait(0.01)   # time.sleep ist in den Tests abgeschaltet – nicht im Leerlauf kreiseln
    m.stop()
    t.join(timeout=5)


def test_sniper_polls_newest_uploads_and_reports_within_seconds(tmp_path):
    old = [feed_item(i, price=20, title="Pullover") for i in range(1, 6)]
    fresh = [feed_item(100, price=9)] + old
    client = FeedClient([old, fresh])
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt"]}})
    run_sniper(m, client, until=lambda: m.notifier.alerts)
    assert client.calls[0] == ("", 30, 1)                # ohne Suchbegriff, nur bis zum Budget
    alert = m.notifier.alerts[0]
    assert alert.item.id == 100 and alert.worker == "Sniper" and alert.search_name == SNIPER
    cap = telegram_caption(alert, now=NOW)
    assert "⚡ vor 8 s hochgeladen" in cap and "⚡ Sniper" in cap


def test_sniper_turns_pages_when_a_lot_was_uploaded(tmp_path):
    full = lambda start: [feed_item(i, price=20, title="Pullover") for i in range(start, start + 96)]  # noqa: E731
    client = FeedClient([full(1), full(1000), full(2000), []])
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt"]}})
    run_sniper(m, client, until=lambda: len(client.calls) >= 4)
    # 1. Blick: Ausgangsbasis · 2. Blick: alles neu -> sofort Seite 2 (und 3) holen, damit nichts fehlt
    assert [c[2] for c in client.calls[:4]] == [1, 1, 2, 3]


def test_sniper_is_off_with_radar_aus(tmp_path):
    client = FeedClient([[feed_item(1)]])
    m = monitor(tmp_path)
    m.storage.set_state("sniper", "0")
    run_sniper(m, client, until=lambda: False)
    assert client.calls == []


def test_age_in_seconds_for_fresh_items():
    assert age_text(NOW - 8, now=NOW) == "vor 8 s"
    assert age_text(NOW - 300, now=NOW) == "vor 5 Min."


# -- Beispiel-Suchen der alten Vorlage ------------------------------------------------------------

def test_old_example_searches_are_paused_once(tmp_path):
    data = {"searches": [
        {"name": "Air Max 90", "keywords": "nike air max 90", "max_price": 60, "sizes": ["43", "44"]},
        {"name": "Carhartt Jacken", "url": "https://www.vinted.de/catalog?search_text=carhartt%20jacke&order=newest_first",
         "max_price": 70, "min_score": 60},
        {"name": "Meine Suche", "keywords": "nike air max 90", "max_price": 60}]}
    m = monitor(tmp_path, data)
    assert m.paused_examples == ["Air Max 90", "Carhartt Jacken"]
    assert [s.name for s in m.active_searches()] == ["Meine Suche"]
    m.storage.set_disabled("Air Max 90", False)          # /weiter – bleibt dann an
    again = Monitor(m.cfg, m.client, m.storage, FakeNotifier(), clock=lambda: NOW)
    assert again.paused_examples == [] and "Air Max 90" in [s.name for s in again.active_searches()]
