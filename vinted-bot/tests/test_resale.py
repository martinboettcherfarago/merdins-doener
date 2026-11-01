import pytest

from conftest import NOW, FakeClient, FakeNotifier, item
from vinted_bot.config import (RESALE_LEVELS, TREND_BRANDS, ConfigError, SearchConfig, config_from_dict,
                               resale_searches)
from vinted_bot.monitor import Monitor
from vinted_bot.notify import Alert, telegram_caption
from vinted_bot.scoring import (Reference, brand_matches, market_reference, meets_targets, normalize,
                                passes_filters, price_group, product_type, score_item)
from vinted_bot.storage import Storage


# -- Konfiguration --------------------------------------------------------------------

def test_resale_section_trends_and_custom_brands():
    trends = resale_searches({"brands": "trends"})
    assert [s.name for s in trends] == [f"Resale · {b}" for b in TREND_BRANDS]
    s = trends[0]
    assert s.is_resale and s.keywords == "Carhartt" and s.brands == ["Carhartt"]
    # Ziele stehen nicht fest in der Suche, sondern kommen zur Laufzeit aus der Stufe
    assert (s.max_age_minutes, s.min_discount, s.min_profit, s.min_cheaper_than) == (None, None, None, None)
    eff = s.with_targets(RESALE_LEVELS["normal"])
    assert (eff.max_age_minutes, eff.min_discount, eff.min_cheaper_than, eff.min_profit) == (10, 40, 90, 15)
    # eigene Werte einer Suche gewinnen gegen die Stufe
    own_value = SearchConfig.resale_for_brand("Nike", min_discount=60).with_targets(RESALE_LEVELS["streng"])
    assert own_value.min_discount == 60 and own_value.max_age_minutes == 5

    own = resale_searches({"brands": ["Stüssy", "trends"], "max_price": 100})
    assert own[0].name == "Resale · Stüssy" and own[0].max_price == 100
    assert len(own) == len(TREND_BRANDS)  # Stüssy nicht doppelt
    assert resale_searches({"enabled": False, "brands": "trends"}) == []


def test_resale_name_clash_and_bad_mode():
    with pytest.raises(ConfigError):
        config_from_dict({"searches": [{"name": "Resale · Nike", "keywords": "x"}], "resale": {"brands": ["Nike"]}})
    with pytest.raises(ConfigError):
        SearchConfig.from_dict({"name": "x", "keywords": "x", "mode": "turbo"})
    with pytest.raises(ConfigError):
        config_from_dict({"resale": {"brands": ["Nike"], "level": "ultra"}})


def test_config_level_and_overrides():
    cfg = config_from_dict({"resale": {"brands": ["Nike"], "level": "streng", "min_profit": 30}})
    assert cfg.resale_targets == {**RESALE_LEVELS["streng"], "min_profit": 30.0}
    assert config_from_dict({}).resale_targets == RESALE_LEVELS["normal"]


# -- Marken & Produkttypen --------------------------------------------------------------

def test_normalize_and_brand_matching():
    assert normalize("Arc'teryx") == "arcteryx" and normalize("Stüssy") == "stussy"
    assert brand_matches(item(1, 10, brand="Carhartt WIP"), ["Carhartt"])
    assert brand_matches(item(1, 10, brand="Carhartt"), ["Carhartt WIP"])
    assert brand_matches(item(1, 10, brand="Stussy"), ["Stüssy"])
    assert brand_matches(item(1, 10, brand="ARC'TERYX"), ["Arc'teryx"])
    # No-Name-Artikel, der die Marke nur im Titel erwähnt -> zählt NICHT
    assert not brand_matches(item(1, 10, brand="No Name", title="Jacke wie Carhartt"), ["Carhartt"])
    # ohne Markenangabe entscheidet der Titel
    assert brand_matches(item(1, 10, brand="", title="Carhartt Detroit Jacket"), ["Carhartt"])


def test_product_types():
    assert product_type("Carhartt WIP Detroit Jacket") == "jacke"
    assert product_type("Nike Air Max 90 Top Zustand") == "schuhe"
    assert product_type("Stüssy Bucket Hat") == "muetze"
    assert product_type("North Face Daunenweste") == "weste"
    assert product_type("Ralph Lauren Strickjacke") == "pullover"
    assert product_type("Irgendwas") == "sonstiges"


def test_price_groups():
    resale = SearchConfig.resale_for_brand("Carhartt")
    normal = SearchConfig(name="Jacken", keywords="jacke")
    jacket = item(1, 50, brand="Carhartt WIP", title="Carhartt Detroit Jacket")
    assert price_group(resale, jacket) == "b:carhartt|jacke"  # "Carhartt WIP" und "Carhartt" teilen Preise
    assert price_group(normal, jacket) == "s:Jacken|jacke"


def test_min_condition_filter():
    s = SearchConfig.resale_for_brand("Nike", min_condition="sehr gut")
    assert passes_filters(item(1, 10, status="Neu mit Etikett"), s, [])[0]
    assert not passes_filters(item(1, 10, status="Gut"), s, [])[0]
    assert passes_filters(item(1, 10, status=""), s, [])[0]  # unbekannt -> nicht aussortieren


# -- Marktpreis & Bewertung ----------------------------------------------------------

def test_market_reference_never_mixes_types_for_resale():
    resale = SearchConfig.resale_for_brand("Carhartt")
    normal = SearchConfig(name="x", keywords="x")
    many = [10.0] * 20
    assert market_reference(resale, [80, 90, 100, 110, 120], many).price == 100
    assert market_reference(resale, [80, 90], many).price is None  # Gruppe zu klein -> kein Vergleich
    assert market_reference(normal, [80, 90], many).price == 10    # normale Suche: ganze Suche als Fallback
    assert market_reference(SearchConfig(name="x", keywords="x", market_price=70), [], []).basis == "dein Marktpreis"


def test_resale_score_rewards_freshness_and_big_discounts():
    ref = Reference(100.0, "12 ähnliche Carhartt Jacken", 12)
    fresh = score_item(item(1, 40, minutes_old=1), ref, now=NOW, resale=True, shipping=5)
    stale = score_item(item(2, 40, minutes_old=25), ref, now=NOW, resale=True, shipping=5)
    small = score_item(item(3, 85, minutes_old=1), ref, now=NOW, resale=True, shipping=5)
    assert fresh.total == 87 and fresh.is_top           # 55 Preis + 25 Frische + 7 Zustand
    assert fresh.total - stale.total == 19
    assert small.total == 46 and not small.is_top        # nur 15 % Rabatt: Frische allein reicht nicht
    assert fresh.profit == pytest.approx(100 - 41.5 - 5)  # Marktpreis - Preis inkl. Käuferschutz - Versand
    assert "12 ähnliche Carhartt Jacken" in fresh.reasons[0]


def test_meets_targets():
    s = SearchConfig.resale_for_brand("Nike").with_targets(RESALE_LEVELS["normal"])  # 40 % Rabatt, 15 € Gewinn
    ref = Reference(100.0)
    assert meets_targets(s, score_item(item(1, 50), ref, now=NOW, resale=True, shipping=5))[0]
    assert meets_targets(s, score_item(item(1, 70), ref, now=NOW, resale=True))[1] == "Rabatt zu klein"
    cheap_ref = Reference(30.0)  # 50 % Rabatt, aber nur ~5 € Gewinn
    assert meets_targets(s, score_item(item(1, 15), cheap_ref, now=NOW, resale=True, shipping=5))[1] == "Gewinn zu klein"
    assert meets_targets(s, score_item(item(1, 15), None, now=NOW, resale=True))[1] == "Marktpreis noch unbekannt"


def test_price_rank_only_the_cheapest():
    # 60 % unter dem Median – aber ein anderes Angebot ist noch billiger
    prices = [30.0] + [100.0] * 9
    ref = Reference(100.0, "10 ähnliche", 10, prices)
    sc = score_item(item(1, 40), ref, now=NOW, resale=True, shipping=5)
    assert sc.cheaper_than == pytest.approx(0.9)
    assert "günstiger als 90% von 10 vergleichbaren Angeboten" in sc.reasons
    normal = SearchConfig.resale_for_brand("Nike").with_targets(RESALE_LEVELS["normal"])  # günstiger als 90 %
    strict = SearchConfig.resale_for_brand("Nike").with_targets(RESALE_LEVELS["streng"])  # günstiger als 95 %
    assert meets_targets(normal, sc)[0]
    assert meets_targets(strict, sc) == (False, "nicht günstig genug im Vergleich")

    best = score_item(item(2, 25), ref, now=NOW, resale=True, shipping=5)
    assert best.cheaper_than == 1.0 and "billigstes von 10 vergleichbaren Angeboten 🏆" in best.reasons
    assert meets_targets(strict, best)[0]


# -- Ablauf im Monitor ---------------------------------------------------------------

@pytest.fixture
def resale_monitor(tmp_path, clock):
    cfg = config_from_dict({"resale": {"brands": ["Carhartt"], "shipping_estimate": 5}}, base_dir=str(tmp_path))
    client, notifier = FakeClient(), FakeNotifier()
    mon = Monitor(cfg, client, Storage(str(tmp_path / "r.db")), notifier, clock=clock)
    mon.pause_between_searches = (0, 0)
    return mon, client, notifier


def carhartt(i, price, title, minutes_old=30, size="M", **kw):
    return item(i, price, title=title, brand="Carhartt WIP", minutes_old=minutes_old, size=size, **kw)


def market():
    # Jacken um 80 €, Mützen um 24 € -> getrennte Marktpreise (Vorwissen: Jacken 75 €, Mützen 15 €)
    jackets = [carhartt(100 + k, 70 + k * 5, "Carhartt Chore Jacket") for k in range(5)]
    beanies = [carhartt(200 + k, 22 + k, "Carhartt Watch Beanie") for k in range(5)]
    return jackets + beanies


def test_resale_monitor_flags_only_fresh_real_bargains(resale_monitor):
    mon, client, notifier = resale_monitor
    base = market()
    client.pages = [base, [
        carhartt(1, 45, "Carhartt Michigan Jacket", minutes_old=2),      # 55 % unter Jacken-Preis -> melden
        carhartt(2, 20, "Carhartt Watch Beanie", minutes_old=2),         # Mütze: normaler Preis -> nicht melden
        carhartt(3, 40, "Carhartt Detroit Jacket", minutes_old=45),      # zu alt -> nicht melden
        item(4, 30, title="Jacke im Carhartt Style", brand="No Name", minutes_old=1),  # keine echte Marke
    ] + base]
    mon.run_once()
    assert client.queries[0].search_text == "Carhartt"
    mon.run_once()
    assert [a.item.id for a in notifier.alerts] == [1]
    a = notifier.alerts[0]
    # Marktpreis = 5 echte Preise (Median 80 €) gemischt mit dem Vorwissen (75 €)
    assert a.resale and a.score.reference_price == 77.5 and a.score.profit == pytest.approx(77.5 - 46.5 - 5)
    assert "5 ähnliche Carhartt WIP Jacken + Vorwissen" in a.score.reasons[0]


def test_resale_caption_shows_profit_and_freshness():
    it = carhartt(1, 45, "Carhartt Michigan Jacket", minutes_old=2)
    score = score_item(it, Reference(100.0, "5 ähnliche Carhartt WIP Jacken", 5), now=NOW, resale=True, shipping=5)
    cap = telegram_caption(Alert(item=it, search_name="Resale · Carhartt", score=score, buy_url="u", resale=True),
                           now=NOW)
    assert "💰 RESALE-DEAL · 55% unter Wert" in cap
    assert "Gewinn-Potenzial ca. +48,50 €" in cap
    assert "⚡ vor 2 Min. hochgeladen" in cap


def test_old_database_is_migrated(tmp_path):
    import sqlite3
    path = str(tmp_path / "old.db")
    db = sqlite3.connect(path)
    db.execute("CREATE TABLE prices (search TEXT NOT NULL, price REAL NOT NULL, ts REAL NOT NULL)")
    db.execute("INSERT INTO prices VALUES ('x', 10, 1)")
    db.commit()
    db.close()
    st = Storage(path)
    st.add_price("x", 20, "b:nike|schuhe")
    assert st.price_history("x") == [20, 10]
    assert st.group_history("b:nike|schuhe") == [20]


@pytest.mark.parametrize("level,expected", [
    ("streng", {3}),        # ≤ 5 Min., ≥ 50 % unter Markt, günstiger als 95 %, ≥ 20 € Gewinn
    ("normal", {1, 2, 3}),  # ≤ 10 Min., ≥ 40 %
])
def test_level_changes_what_gets_reported(resale_monitor, level, expected):
    mon, client, notifier = resale_monitor
    base = market()
    client.pages = [base, [
        carhartt(1, 44, "Carhartt Michigan Jacket", minutes_old=3),   # ca. 43 % unter Markt
        carhartt(2, 32, "Carhartt Michigan Jacket", minutes_old=8),   # ca. 58 % unter Markt, aber 8 Min. alt
        carhartt(3, 30, "Carhartt Michigan Jacket", minutes_old=2),   # 60 % unter Markt, ganz frisch
    ] + base]
    mon.storage.set_state("resale_level", level)
    mon.run_once()
    mon.run_once()
    assert {a.item.id for a in notifier.alerts} == expected
