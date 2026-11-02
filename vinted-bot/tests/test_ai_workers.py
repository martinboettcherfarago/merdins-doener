"""KI-Bildcheck (mit nachgebautem Anthropic-Client), parallele Sucher, Taktgeber, mehr Vintage Adidas."""

import json
import threading
import time
from types import SimpleNamespace

import pytest

from conftest import NOW, FakeNotifier, item
from test_telegram import FakeTelegram, msg
from vinted_bot.config import SearchConfig, config_from_dict
from vinted_bot.monitor import Monitor, Pacer
from vinted_bot.notify import telegram_caption
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController
from vinted_bot.vision import AiReviewer, AiVerdict, image_media_type

JPEG = b"\xff\xd8\xff\xe0" + b"0" * 200


def verdict(**kw):
    data = {"erkannt": "Adidas Trainingsjacke, 90er", "jahrzehnt": "90er", "echtheit": "wahrscheinlich_echt",
            "echtheit_gruende": ["Ventex-Etikett", "saubere Stickerei"], "zustand": "leichte Gebrauchsspuren",
            "look": 8, "trend": 9, "wert_eur": 55, "urteil": "kaufen", "begruendung": "Gefragtes 90er-Teil."}
    data.update(kw)
    return data


class FakeMessages:
    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = []

    def create(self, **kw):
        self.calls.append(kw)
        payload = self.payloads.pop(0) if len(self.payloads) > 1 else self.payloads[0]
        return SimpleNamespace(
            content=[SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=json.dumps(payload))],
            stop_reason="end_turn", usage=SimpleNamespace(input_tokens=5000, output_tokens=800))


def make_reviewer(storage, payloads, **ai):
    cfg = config_from_dict({"ai": {"enabled": True, "api_key": "test", **ai}})
    fake = SimpleNamespace(beta=SimpleNamespace(messages=FakeMessages(payloads)))
    r = AiReviewer(cfg, storage, lambda it: ["https://img/1.jpg", "https://img/2.jpg"], lambda url: JPEG, client=fake)
    r.submit = lambda kind, payload, done: done(kind, payload)  # im Test sofort statt im Hintergrund
    return r, fake.beta.messages


# -- KI-Bildcheck -------------------------------------------------------------------------

def test_review_sends_photos_and_parses_verdict(tmp_path):
    st = Storage(str(tmp_path / "a.db"))
    r, api = make_reviewer(st, [verdict()])
    v = r.review(item(1, 12, title="Adidas Trainingsjacke vintage", brand="Adidas"), "Titel: …")
    assert v.urteil == "kaufen" and v.look == 8 and v.wert_eur == 55 and v.photos == 2
    call = api.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default" and call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_config"]["format"]["type"] == "json_schema" and call["output_config"]["effort"] == "medium"
    content = call["messages"][0]["content"]
    assert [b["type"] for b in content] == ["image", "image", "text"]
    assert content[0]["source"]["media_type"] == "image/jpeg"
    assert r.used_today() == 1 and r.cost_today() == pytest.approx((5000 * 4 + 800 * 20) / 1e6)
    assert "🔍 ✅ wirkt echt (Ventex-Etikett; saubere Stickerei)" in v.lines()


def test_budget_and_disable(tmp_path):
    st = Storage(str(tmp_path / "b.db"))
    r, _ = make_reviewer(st, [verdict()], max_checks_per_day=1)
    it = item(1, 12, title="x")
    assert r.review(it, "") is not None and r.review(it, "") is None  # Tageslimit
    st.set_state("ai_enabled", "0")
    assert not r.enabled


def test_verdict_values_are_clamped():
    v = AiVerdict.from_json(verdict(look=14, trend=-3, echtheit_gruende=["a", "b", "c", "d"]))
    assert (v.look, v.trend, len(v.echtheit_gruende)) == (10, 0, 3)
    assert image_media_type(JPEG) == "image/jpeg" and image_media_type(b"nope") is None


@pytest.fixture
def mon(tmp_path):
    cfg = config_from_dict({"resale": {"brands": ["Vintage Adidas"]}}, base_dir=str(tmp_path))
    from conftest import FakeClient
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "m.db")), FakeNotifier(), clock=lambda: NOW)
    m.pause_between_searches = (0, 0)
    return m


def deal(i=1, price=12, title="Adidas Trainingsjacke vintage 90er", minutes_old=2):
    return item(i, price, title=title, brand="Adidas", size="M", minutes_old=minutes_old)


def test_ai_check_blocks_fakes_and_annotates_real_items(mon):
    mon.reviewer, _ = make_reviewer(mon.storage, [verdict(echtheit="fake_verdacht",
                                                          echtheit_gruende=["Logo verzogen"]), verdict()])
    mon.client.pages = [[], [deal(1)], [deal(2)]]
    mon.run_once()
    mon.run_once()
    assert mon.notifier.alerts == [] and mon.stats["ai_fakes"] == 1   # Fake nicht gemeldet
    mon.run_once()
    a = mon.notifier.alerts[0]
    assert a.ai.urteil == "kaufen"
    cap = telegram_caption(a, now=NOW)
    assert "🤖 KI-Check (2 Fotos)" in cap and "🧭 Urteil: 👍 kaufen" in cap and len(cap) <= 1024


def test_second_look_finds_what_the_rules_underrate(mon):
    mon.reviewer, api = make_reviewer(mon.storage, [verdict(wert_eur=60, look=8)])
    # 35 € für eine "normale" Adidas-Jacke: laut Faustregel kein Schnäppchen – die KI sieht ein 90er-Teil für 60 €
    mon.client.pages = [[], [deal(1, price=30, title="Adidas Jacke 90er")]]
    mon.run_once()
    mon.run_once()
    assert len(api.calls) == 1
    a = mon.notifier.alerts[0]
    assert a.ai_find and "🤖✨ KI-FUND" in telegram_caption(a, now=NOW)
    assert a.score.value == 60 and mon.stats["ai_finds"] == 1
    mon.client.pages = [[deal(1, price=30, title="Adidas Jacke 90er")]]
    mon.run_once()
    assert len(api.calls) == 1  # derselbe Artikel wird nicht zweimal geprüft


def test_feedback_teaches_the_ai(mon):
    mon.reviewer, api = make_reviewer(mon.storage, [verdict()])
    mon.storage.save_item(deal(5, title="Adidas Firebird Jacke"), "jacke")
    mon.record_feedback(5, True)
    mon.reviewer.review(deal(6), "Titel")
    assert "Gefällt: Adidas Firebird Jacke" in api.calls[0]["messages"][0]["content"][-1]["text"]


def test_ai_commands(mon):
    mon.reviewer, _ = make_reviewer(mon.storage, [verdict()])
    tg = FakeTelegram()
    ctl = TelegramController(tg, mon, None)
    ctl.handle_update(msg("/ki"))
    assert "KI-Bildcheck: an" in tg.texts()[-1]
    ctl.handle_update(msg("/pruefen https://www.vinted.de/items/123456-adidas-trainingsjacke-90er"))
    assert "🤖 KI-Check (2 Fotos): Adidas Trainingsjacke, 90er" in tg.texts()[-1]
    ctl.handle_update(msg("/ki aus"))
    assert "KI-Bildcheck: aus" in tg.texts()[-1]


# -- Parallele Sucher & Taktgeber -----------------------------------------------------------

def test_pacer_spaces_requests_from_all_workers():
    pacer, stop, times, lock = Pacer(0.05), threading.Event(), [], threading.Lock()

    def worker(name):
        for _ in range(4):
            pacer.wait(stop)
            with lock:
                times.append((time.monotonic(), name))

    threads = [threading.Thread(target=worker, args=(n,)) for n in "AB"]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    stamps = sorted(t for t, _ in times)
    assert len(stamps) == 8 and all(b - a >= 0.035 for a, b in zip(stamps, stamps[1:]))
    assert {n for _, n in times} == {"A", "B"}


class KeyedClient:
    """Vinted-Ersatz für mehrere Sucher: 1. Abfrage je Suchbegriff = leer (lernen), danach der Deal."""

    def __init__(self, deal_item):
        self.deal, self.seen, self.lock = deal_item, set(), threading.Lock()

    def search(self, query, per_page=48):
        with self.lock:
            first = query.search_text not in self.seen
            self.seen.add(query.search_text)
        return [] if first else [self.deal]


def test_two_workers_alternate_and_never_double_report(tmp_path):
    cfg = config_from_dict({"vinted": {"workers": 2, "request_gap_seconds": 0.5},
                            "resale": {"brands": ["Vintage Adidas", "Adidas Trainingsjacke"]}},
                           base_dir=str(tmp_path))
    cfg.request_gap_seconds = 0.02
    cfg.interval_seconds = 0
    client = KeyedClient(deal())
    notifier = FakeNotifier()
    m = Monitor(cfg, client, Storage(str(tmp_path / "w.db")), notifier, clock=lambda: NOW)
    m.min_cycle_wait = 0.05
    m.scheduler_settings = {"fast_gap": 0.05, "min_gap": 0.05, "max_gap": 0.2, "stagger": 0.01}
    t = threading.Thread(target=m.run_forever, kwargs={"client_factory": lambda: client})
    t.start()
    deadline = time.time() + 10
    while time.time() < deadline and m.stats["workers"].get("B", {}).get("cycles", 0) < 3:
        time.sleep(0.05)
    m.stop()
    t.join(timeout=10)
    workers = m.stats["workers"]
    assert workers["A"]["cycles"] >= 2 and workers["B"]["cycles"] >= 2   # beide Sucher arbeiten
    assert len(notifier.alerts) == 1                                     # aber nur EINE Meldung
    assert notifier.alerts[0].worker in ("A", "B", "Sniper")              # der Sniper darf auch zuerst sein


# -- Mehr Vintage Adidas ------------------------------------------------------------------------

def test_more_vintage_adidas(mon):
    from vinted_bot.config import TREND_WATCHES
    for entry in ["Vintage Adidas", "Adidas Originals vintage", "Adidas 90er", "Adidas Firebird", "Adidas Trefoil"]:
        assert entry in TREND_WATCHES
    s = mon.effective(SearchConfig.watch("Adidas 90er"))
    assert (s.min_discount, s.min_profit) == (35, 8)
    # vintage Adidas-Pullover für 9 €: ca. 15 € Gewinn – früher knapp zu wenig, jetzt gemeldet
    sweat = item(1, 9, title="Vintage Adidas Pullover 90er", brand="Adidas", size="M", minutes_old=2)
    alert, why = mon.explain(s, sweat, NOW)
    assert alert is not None, why
    strict = mon.effective(SearchConfig.watch("Carhartt"))  # andere Suchen bleiben bei 15 € Mindestgewinn
    assert strict.min_profit == 15


def test_stored_adidas_watch_gets_new_presets(tmp_path):
    from conftest import FakeClient
    st = Storage(str(tmp_path / "p.db"))
    st.add_search(SearchConfig.from_dict({"name": "Trend · Vintage Adidas", "keywords": "Vintage Adidas",
                                          "brands": ["Adidas"], "mode": "resale"}, source="telegram"))
    Monitor(config_from_dict({}), FakeClient(), st, FakeNotifier(), clock=lambda: NOW)
    s = st.custom_searches()[0]
    assert (s.min_discount, s.min_profit) == (35, 8)
