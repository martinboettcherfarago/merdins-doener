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
    # dieselben Extras wie jede Schnäppchen-Meldung: Fake-Ampel, Gewinn, Angebots-Buttons, Wert-Schätzung
    assert alert.resale and alert.ampel is not None and alert.offers and alert.score.value and alert.score.profit
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
    sched = Scheduler(fast_gap=4, min_gap=8, max_gap=180, target_new=10, stagger=1, shuffle=False)
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
    assert why("Pullover 90er vintage", "") == "Sniper: keine Marke aus deiner Liste"   # No-Name nur, wenn selten
    for title, brand in [("Carhartt Pullover", "Carhartt"), ("Adidas Pullover", "Adidas"),
                         ("Ralph Lauren Pullover", "Ralph Lauren"), ("Vintage Pullover 90er Made in USA", "")]:
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


# -- Sniper bewertet genauso wie die Marken-Suchen -------------------------------------------------

def test_sniper_uses_the_same_estimates_and_your_brand_settings(tmp_path):
    from vinted_bot.knowledge import estimate_item
    data = {"resale": {"brands": ["Vintage Adidas", "Adidas"], "budget": 500, "budget_brands": 500},
            "searches": [{"name": "Marke · Stone Island", "keywords": "Stone Island", "brands": ["Stone Island"],
                          "mode": "resale", "min_discount": 60}]}
    m = monitor(tmp_path, data)
    sniper = m.sniper_search()

    def at(discount, title, brand, i):
        probe = feed_item(i, 1, title=title, brand=brand)
        value = estimate_item(probe).value
        return feed_item(i, round(value * (1 - discount), 2), title=title, brand=brand)

    # Stone Island: deine Regel "mind. 60 % unter Wert" gilt auch im Sniper (normal wären 40 %)
    si = at(0.5, "Stone Island Pullover", "Stone Island", 1)
    assert m.explain(sniper, si, NOW)[1] == "Rabatt zu klein"
    assert m.explain(m.effective(SearchConfig.watch("Stone Island")), si, NOW)[0] is not None  # ohne Regel: ok
    # Vintage Adidas: 35 % reichen (Voreinstellung der Trend-Suche) – auch im Sniper …
    vintage = at(0.38, "Vintage Adidas Pullover 90er", "Adidas", 2)
    alert, why = m.explain(sniper, vintage, NOW)
    assert alert is not None, why
    # … aber ein normales Adidas-Teil braucht weiter 40 %
    plain = at(0.38, "Adidas Pullover", "Adidas", 3)
    assert m.explain(sniper, plain, NOW)[1] == "Rabatt zu klein"
    # dieselbe Schätzung wie bei den Marken-Suchen (Marke × Kategorie × Zustand, gelernte Preise)
    brand_alert, _ = m.explain(m.effective(SearchConfig.watch("Vintage Adidas")), vintage, NOW)
    assert brand_alert.score.value == alert.score.value and brand_alert.score.discount == alert.score.discount


# -- Stetiger Fluss: Gewinn relativ zum Preis, Auto-Stufe -----------------------------------------

def test_cheap_brand_items_need_less_absolute_profit_but_fast_fashion_does_not():
    from vinted_bot.scoring import profit_needed
    assert profit_needed(15, 8) == 8 and profit_needed(15, 20) == 10 and profit_needed(15, 40) == 15
    assert profit_needed(15, 8, "budget") == 15            # H&M, Zara … lohnen sich kaum


def test_auto_level_stays_between_normal_and_streng(tmp_path):
    m = monitor(tmp_path)
    assert m.auto_active() and m.auto_level() == "normal" and m.level_label() == "auto (gerade „normal“)"
    start = m.stats["started"]
    assert m._auto_adjust(now=start + 600) is None                    # erst nach 15 Min. urteilen
    assert m._auto_adjust(now=start + 3600) is None                   # Flaute: nie lockerer als "normal"
    m._alert_times.extend(start + 3600 + i * 60 for i in range(15))   # 15 Treffer in 15 Min. = 60/Std.
    assert m._auto_adjust(now=start + 3600 + 900) == "streng"         # zu viel -> strenger
    assert m.resale_targets()["min_discount"] == 50 and "Auto-Stufe" in m.notifier.texts[-1]
    assert m._auto_adjust(now=start + 3600 + 1000) is None            # nicht ständig hin und her
    assert m._auto_adjust(now=start + 3600 + 900 + 3600) == "normal"  # danach ruhig -> wieder "normal"
    m.storage.set_state("resale_level", "locker")                    # feste Stufe: Auto aus
    assert not m.auto_active() and m.resale_targets()["min_discount"] == 30


def test_stufe_auto_command(tmp_path):
    m = monitor(tmp_path)
    tg = FakeTelegram()
    ctl = TelegramController(tg, m, None)
    ctl.handle_update(msg("/stufe normal"))
    assert not m.auto_active()
    ctl.handle_update(msg("/stufe auto"))
    assert m.auto_active() and "Auto-Stufe an" in tg.texts()[-1]


# -- 📈 /live: misst, was wirklich reinkommt ---------------------------------------------------------

def test_live_check_measures_tempo_freshness_prices_and_reasons():
    from types import SimpleNamespace as NS
    from vinted_bot.livestats import LiveStats, reason_key
    live, t0 = LiveStats(), 1_000_000.0
    for i in range(12):                                   # Sniper alle 5 s, je 15 neue Artikel
        live.poll(15, True, now=t0 + i * 5)
    live.poll(40, False, now=t0 + 3)                      # eine Marken-Suche
    for i, (price, age) in enumerate([(9, 6), (14, 9), (22, 30), (75, 12)]):
        item_ = NS(created_ts=t0 + 60 + i * 60 - age, price=price, brand="Stone Island" if price > 30 else "Adidas")
        live.alert(NS(item=item_, search_name=SNIPER if i < 3 else "Marke · Stone Island", worker="A"),
                   now=t0 + 60 + i * 60)
    for why in ["Größe XL passt nicht (S, M, L)", "Größe XS passt nicht (S, M, L)", "Rabatt zu klein",
                "über deinem Budget (30 €)", "Sniper: keine Marke aus deiner Liste"]:
        live.reject(why, now=t0 + 100)
    s = live.summary(minutes=60, now=t0 + 300)
    assert s["sniper_polls"] == 12 and s["sniper_gap"] == 5 and s["sniper_new"] == 15
    assert s["alerts"] == 4 and s["from_sniper"] == 3 and s["age_median"] == 10.5
    assert s["price_median"] == 18 and s["share_20"] == 0.5 and s["max"][2] == 75
    assert s["reasons"][0] == ("Größe passt nicht", 2)
    text = live.text(60, now=t0 + 300, level="auto (gerade „normal“)")
    assert "alle ~5 s" in text and "4 Meldungen</b> (3 vom Sniper)" in text and "erst 10 s online" in text
    assert "Median 18 €" in text and "teuerstes 75 € (Stone Island)" in text and "Größe passt nicht 40%" in text
    assert reason_key("schon 45 Min. online") == "schon zu lange online"


def test_live_command_and_monitor_records_alerts(tmp_path):
    m = monitor(tmp_path)
    tg = FakeTelegram()
    ctl = TelegramController(tg, m, None)
    alert = m.explain(m.sniper_search(), feed_item(1, 12, seconds_old=0), NOW)[0]
    alert.item.created_ts = time.time() - 7
    m.live.poll(20, True)
    assert m._send(alert)
    ctl.handle_update(msg("/live"))
    text = tg.texts()[-1]
    assert "Live-Check – letzte 60 Min." in text and "1 Meldungen</b> (1 vom Sniper)" in text
    assert "erst 7 s online" in text and "Median 12 €" in text


def test_auto_level_never_goes_below_normal(tmp_path):
    m = monitor(tmp_path)
    m.storage.set_state("auto_level", "offen")                     # Rest aus einer älteren Version
    t = m.resale_targets()
    assert m.auto_level() == "normal" and t["min_discount"] == 40 and t["min_condition"] == "gut"


# -- 🔔 Push-Ton nur für Sniper-Treffer -------------------------------------------------------------

def test_only_sniper_hits_make_a_push_sound(tmp_path):
    m = monitor(tmp_path)
    tg = FakeTelegram()
    m.notifier = tg
    sniper_alert = m.explain(m.sniper_search(), feed_item(1, 9), NOW)[0]
    sniper_alert.worker = "Sniper"
    brand_alert = m.explain(m.effective(SearchConfig.watch("Carhartt")),
                            feed_item(2, 9, title="Carhartt Pullover vintage 90er", brand="Carhartt"), NOW)[0]
    brand_alert.worker = "A"
    for a in (sniper_alert, brand_alert):
        a.item.photo_url = None
        m._send(a)
    (_, loud), (_, quiet) = tg.calls[-2:]
    assert "disable_notification" not in loud and loud["text"].startswith("<b>⚡ SNIPER ·")
    assert quiet["disable_notification"] is True and "SNIPER" not in quiet["text"]
    ctl = TelegramController(tg, m, None)
    ctl.handle_update(msg("/push alle"))
    assert m.push_mode() == "alle" and "Push-Ton: alle" in tg.texts()[-1]
    m._send(brand_alert)
    assert "disable_notification" not in tg.calls[-1][1]
    ctl.handle_update(msg("/push aus"))
    m._send(sniper_alert)
    assert tg.calls[-1][1]["disable_notification"] is True


# -- Vinted bremst: kurz pausieren, Tempo anpassen ------------------------------------------------------

def test_pacer_adapts_to_vinted_rate_limits():
    p = Pacer(1.0)
    assert p.rate_limited() == 15 and p.gap == 1.75          # 1. Bremse: 15 s Pause, etwas langsamer
    assert p.rate_limited() == 30 and p.gap > 2.5             # 2. Bremse in Folge: 30 s
    assert p.rate_limited(retry_after=7) == 7                 # Vinted nennt die Wartezeit -> genau die
    for _ in range(4):
        p.rate_limited()
    assert p.gap == Pacer.MAX_GAP and p.rate_limited() == 60  # nie langsamer als 6 s, nie länger als 60 s Pause
    for _ in range(30 * 20):
        p.success()
    assert p.gap == 1.0                                       # läuft es rund, wieder volles Tempo


def test_worker_pauses_briefly_instead_of_a_minute(tmp_path):
    from vinted_bot.vinted import VintedRateLimited

    class Grumpy(FeedClient):
        def search(self, query, per_page=48, page=1):
            with self.lock:
                self.calls.append((query.search_text, query.price_to, page))
                if len(self.calls) == 2:
                    raise VintedRateLimited()
                return []
    client = Grumpy()
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt"]}})
    run_workers(m, client, until=lambda: m.live.summary()["ratelimits"] >= 1)
    assert m.live.summary()["ratelimits"] == 1 and m.pacer.gap > 0
    assert "🚦 Vinted-Bremse: 1×" in m.live.text(60)


# -- Abwechslung: nicht ständig dieselbe Marke -----------------------------------------------------

def test_brand_variety_raises_the_bar_for_a_brand_that_came_often(tmp_path):
    from vinted_bot.knowledge import estimate_item
    m = monitor(tmp_path, {"resale": {"brands": ["Carhartt", "Adidas"], "budget": 500, "budget_brands": 500}})

    def at(discount, brand, i):
        probe = feed_item(i, 1, title=f"{brand} Jacke", brand=brand)
        return feed_item(i, round(estimate_item(probe).value * (1 - discount), 2), title=f"{brand} Jacke",
                         brand=brand, seconds_old=30)
    carhartt = m.effective(SearchConfig.watch("Carhartt"))
    assert m.explain(carhartt, at(0.45, "Carhartt", 1), NOW)[0] is not None
    m._brand_alerts.extend((NOW - 600, "carhartt") for _ in range(3))     # schon 3× Carhartt in der Stunde
    alert, why = m.explain(carhartt, at(0.45, "Carhartt", 2), NOW)
    assert alert is None and why.startswith("Marken-Vielfalt: Carhartt kam in der letzten Stunde schon 3×")
    assert m.explain(carhartt, at(0.6, "Carhartt", 3), NOW)[0] is not None   # ein echter Knaller kommt trotzdem
    adidas = m.effective(SearchConfig.watch("Adidas"))
    assert m.explain(adidas, at(0.55, "Adidas", 4), NOW)[0] is not None      # andere Marken ganz normal


def test_new_searches_start_in_random_order_and_nike_is_in_the_list():
    from types import SimpleNamespace as NS
    from vinted_bot.config import TREND_WATCHES
    assert "Nike" in TREND_WATCHES and "Adidas" in TREND_WATCHES
    searches = [NS(name=f"S{i}", sweep=False) for i in range(40)]
    firsts = set()
    for _ in range(5):
        sched = Scheduler(stagger=1)
        firsts.add(sched.take(searches, now=0)[0].name)
    assert len(firsts) > 1          # nicht jedes Mal dieselbe Suche zuerst
