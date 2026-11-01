import pytest

from conftest import FakeClient, FakeNotifier, item
from vinted_bot.config import SearchConfig
from vinted_bot.monitor import Monitor
from vinted_bot.storage import Storage


@pytest.fixture
def setup(cfg, tmp_path, clock):
    client, notifier = FakeClient(), FakeNotifier()
    storage = Storage(str(tmp_path / "t.db"))
    mon = Monitor(cfg, client, storage, notifier, clock=clock)
    mon.pause_between_searches = (0, 0)
    return mon, client, notifier, storage


def baseline(n=10, start=100):
    # 10 Artikel um 40 € -> Referenzpreis 40 €
    return [item(start + i, 38 + (i % 5), minutes_old=30) for i in range(n)]


def test_first_run_only_learns_prices(setup):
    mon, client, notifier, storage = setup
    client.pages = [baseline()]
    assert mon.run_once() == 0
    assert notifier.alerts == []
    assert storage.is_seeded("Air Max")
    assert len(storage.price_history("Air Max")) == 10
    assert client.queries[0].search_text == "nike air max 90"


def test_new_cheap_item_is_reported_as_top_deal(setup):
    mon, client, notifier, storage = setup
    old = baseline()
    client.pages = [old, [item(1, 20, minutes_old=1, status="Neu mit Etikett")] + old]
    mon.run_once()
    assert mon.run_once() == 1
    alert = notifier.alerts[0]
    assert alert.item.id == 1 and alert.kind == "new"
    assert alert.score.is_top
    # 10 echte Preise (Median 40 €) gemischt mit der Schätzung für Nike-Sneaker (50 €)
    assert alert.score.reference_price == pytest.approx(43.33, abs=0.01)
    assert alert.offers == [18.0, 16.0]
    assert "transaction%5Bitem_id%5D=1" in alert.buy_url
    assert storage.get_item(1)["seller_id"] == 901  # für Angebots-Buttons gemerkt


def test_old_bumped_items_and_excluded_words_are_skipped(setup):
    mon, client, notifier, _ = setup
    old = baseline()
    client.pages = [old, [item(1, 20, minutes_old=600), item(2, 20, title="Air Max 90 Fake")] + old]
    mon.run_once()
    mon.run_once()
    assert notifier.alerts == []


def test_price_drop_is_reported(setup):
    mon, client, notifier, _ = setup
    old = baseline()
    dropped = [item(100, 25, minutes_old=30)] + old[1:]
    client.pages = [old, dropped]
    mon.run_once()
    mon.run_once()
    assert len(notifier.alerts) == 1
    a = notifier.alerts[0]
    assert a.kind == "price_drop" and a.old_price == 38 and a.item.price == 25
    assert "gesenkt" in a.score.reasons[0]


def test_min_score_filters_mediocre_items(setup, cfg):
    mon, client, notifier, _ = setup
    cfg.searches[0].min_score = 70
    old = baseline()
    client.pages = [old, [item(1, 41, minutes_old=1), item(2, 15, minutes_old=1)] + old]
    mon.run_once()
    mon.run_once()
    assert [a.item.id for a in notifier.alerts] == [2]


def test_pause_and_disabled_searches(setup):
    mon, client, notifier, storage = setup
    old = baseline()
    client.pages = [old, [item(1, 20, minutes_old=1)] + old]
    mon.run_once()
    storage.set_state("paused", "1")
    mon.run_once()
    assert notifier.alerts == []  # pausiert: gemerkt, aber nicht gemeldet

    storage.set_disabled("Air Max", True)
    assert mon.active_searches() == []


def test_custom_searches_and_errors(setup):
    mon, client, notifier, storage = setup
    storage.add_search(SearchConfig(name="Carhartt", keywords="carhartt", source="telegram"))
    assert [s.name for s in mon.all_searches()] == ["Air Max", "Carhartt"]

    def boom(query, per_page=48):
        raise RuntimeError("Netzwerk weg")

    client.search = boom
    assert mon.run_once() == 0
    assert mon.stats["errors"] == 2
    assert "Netzwerk weg" in mon.stats["last_error"]
