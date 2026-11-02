"""⚡ Sniper (neueste Uploads alle paar Sekunden), Budget und pausierte Beispiel-Suchen."""

import threading
import time

from conftest import NOW, FakeNotifier, item
from test_telegram import FakeTelegram, msg
from vinted_bot.config import SearchConfig, config_from_dict
from vinted_bot.monitor import SNIPER, Monitor, Pacer
from vinted_bot.notify import age_text, telegram_caption
from vinted_bot.scheduler import Scheduler
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
    """Wie Vinted: pro Suchbegriff eine Folge von Seiten ("" = Sniper, neueste Uploads auf ganz Vinted)."""

    def __init__(self, pages=None, by_text=None):
        self.by_text = {"": list(pages or [])}
        self.by_text.update(by_text or {})
        self.calls, self.lock = [], threading.Lock()

    def search(self, query, per_page=48, page=1):
        with self.lock:
            self.calls.append((query.search_text, query.price_to, page))
            feed = self.by_text.get(query.search_text, [])
            if callable(feed):
                return feed()
            return feed.pop(0) if feed else []

    def texts(self, text):
        return [c for c in self.calls if c[0] == text]


def feed_item(i, price=9, title="Vintage Adidas Trainingsjacke 90er", seconds_old=8, brand="Adidas"):
    it = item(i, price, title=title, brand=brand, size="M")
    it.created_ts = NOW - seconds_old
    return it


def run_workers(m, client, until, seconds=10, max_gap=0.5):
    m.pacer = Pacer(0.0)
    m.scheduler = Scheduler(fast_gap=0.01, min_gap=0.02, max_gap=max_gap, stagger=0.0, first_gap=0.05)
    t = threading.Thread(target=m._worker, args=(0, 1, client), daemon=True)
    t.start()
    deadline, tick = time.time() + seconds, threading.Event()
    while time.time() < deadline and not until():
        tick.wait(0.01)   # time.sleep ist in den Tests abgeschaltet – nicht im Leerlauf kreiseln
    m.stop()
    t.join(timeout=5)


def test_sniper_polls_newest_uploads_and_reports_within_seconds(tmp_path):
    old = [feed_item(i, price=20, title="Pullover") for i in range(1, 6)]
    fresh = [feed_item(100, price=9)] + old
    client = FeedClient([old, fresh])
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt"]}})
    run_workers(m, client, until=lambda: m.notifier.alerts)
    assert client.texts("")[0] == ("", 30, 1)            # ohne Suchbegriff, nur bis zum Budget
    alert = m.notifier.alerts[0]
    assert alert.item.id == 100 and alert.worker == "Sniper" and alert.search_name == SNIPER
    cap = telegram_caption(alert, now=NOW)
    assert "⚡ vor 8 s hochgeladen" in cap and "⚡ Sniper" in cap


def test_sniper_turns_pages_when_a_lot_was_uploaded(tmp_path):
    full = lambda start: [feed_item(i, price=20, title="Pullover") for i in range(start, start + 96)]  # noqa: E731
    client = FeedClient([full(1), full(1000), full(2000), []])
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt"]}})
    run_workers(m, client, until=lambda: len(client.texts("")) >= 4)
    # 1. Blick: Ausgangsbasis · 2. Blick: alles neu -> sofort Seite 2 (und 3) holen, damit nichts fehlt
    assert [c[2] for c in client.texts("")[:4]] == [1, 1, 2, 3]


def test_sniper_is_off_with_radar_aus(tmp_path):
    client = FeedClient([[feed_item(1)]])
    m = monitor(tmp_path)
    m.storage.set_state("sniper", "0")
    run_workers(m, client, until=lambda: len(client.calls) >= 6)
    assert client.texts("") == [] and client.calls      # Marken-Suchen laufen weiter


def test_busy_brands_are_checked_much_more_often_than_quiet_ones(tmp_path):
    counter, last = iter(range(10_000, 99_999)), [time.monotonic()]

    def busy():  # wie echt: je länger seit dem letzten Blick, desto mehr neue Uploads (~100 pro Sekunde)
        now = time.monotonic()
        n, last[0] = max(1, min(20, int((now - last[0]) * 100))), now
        return [feed_item(next(counter), price=25, title="Carhartt Pullover", brand="Carhartt") for _ in range(n)]
    quiet = [feed_item(5, price=25, title="Stone Island Pullover", brand="Stone Island")]
    client = FeedClient([], by_text={"Carhartt": busy, "Stone Island": lambda: list(quiet)})
    m = monitor(tmp_path)
    m.storage.set_state("sniper", "0")
    run_workers(m, client, until=lambda: len(client.texts("Carhartt")) >= 30, max_gap=5.0)
    assert len(client.texts("Carhartt")) >= 30 and len(client.texts("Stone Island")) <= 6
    tempo = dict(m.scheduler.tempo())
    assert tempo["Marke · Carhartt"] < tempo["Marke · Stone Island"]


def test_scheduler_tempo_rules():
    from types import SimpleNamespace as NS
    sched = Scheduler(fast_gap=4, min_gap=8, max_gap=180, target_new=10, stagger=1)
    sniper, nike, vw = NS(name=SNIPER, sweep=True), NS(name="Nike", sweep=False), NS(name="VW", sweep=False)
    first, _ = sched.take([nike, vw, sniper], now=0)
    assert first is sniper                                    # Sniper hat Vorrang
    assert sched.take([nike, vw, sniper], now=0)[0] is nike   # dann der Reihe nach (gestaffelt)
    assert sched.take([nike, vw, sniper], now=0) == (None, 1.0)
    sched.done(sniper, 20, False, True, now=0)
    for t, (n_new, v_new) in enumerate([(0, 0), (40, 1), (40, 0)], start=1):
        sched.done(nike, n_new, False, True, now=t * 20)
        sched.done(vw, v_new, False, True, now=t * 20)
    tempo = dict(sched.tempo())
    assert tempo[SNIPER] == 4 and 8 <= tempo["Nike"] <= 15 and tempo["VW"] >= 150
    sched.done(vw, 96, True, True, now=100)                   # ganze Seite neu -> sofort schneller
    assert dict(sched.tempo())["VW"] == 8


def test_sniper_only_reports_brands_from_your_list_and_premium(tmp_path):
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt", "Adidas"]}})
    sniper = m.sniper_search()
    why = lambda title, brand: m.explain(sniper, feed_item(1, 9, title=title, brand=brand), NOW)[1]  # noqa: E731
    assert why("Esprit Pullover", "Esprit") == "Sniper: keine Marke aus deiner Liste"
    assert why("H&M Jacke", "H&M") == "Sniper: keine Marke aus deiner Liste"
    for title, brand in [("Carhartt Pullover", "Carhartt"), ("Adidas Pullover", "Adidas"),
                         ("Ralph Lauren Pullover", "Ralph Lauren"), ("Pullover 90er vintage", "")]:
        assert why(title, brand) != "Sniper: keine Marke aus deiner Liste", title


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
