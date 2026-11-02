"""Training & Kalibrierung: Vorwissen, Raritäten, Größen/Kategorien, Lernen aus 👍/👎 und Musterdaten."""

import pytest

from conftest import NOW, FakeClient, FakeNotifier, item
from test_telegram import FakeTelegram, msg
from vinted_bot.config import SearchConfig, config_from_dict
from vinted_bot.knowledge import brand_key, prior_price, rarity, resolve_type, size_matches
from vinted_bot.monitor import Monitor
from vinted_bot.notify import Alert, telegram_caption, telegram_keyboard
from vinted_bot.sample_data import run_sample
from vinted_bot.scoring import Reference, market_reference, product_type, score_item
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController


# -- Vorwissen --------------------------------------------------------------------------

def test_brand_keys_and_priors():
    assert brand_key("Carhartt WIP") == "carhartt"
    assert brand_key("Polo Ralph Lauren") == "ralphlauren"
    assert brand_key("C.P. Company") == "cpcompany"
    assert prior_price("Arc'teryx", "jacke") == 200
    assert prior_price("Zara", "jacke") is None


def test_prior_is_mixed_with_real_prices_and_fades_out():
    s = SearchConfig.resale_for_brand("Carhartt")
    assert market_reference(s, [], [], prior=75).price == 75                       # nur Vorwissen
    assert market_reference(s, [100.0] * 5, [], prior=75).price == pytest.approx(87.5)  # halb/halb
    assert market_reference(s, [100.0] * 30, [], prior=75).price == 100           # genug echte Daten
    assert market_reference(s, [100.0] * 5, [], prior=75, own_price=60).basis == "dein Marktpreis"


# -- Raritäten ---------------------------------------------------------------------------

@pytest.mark.parametrize("title,brand,level", [
    ("Vintage Carhartt Detroit Jacket Made in USA", "Carhartt", 2),
    ("Carhartt WIP Hoodie", "Carhartt WIP", 0),
    ("Vintage Nike Pullover", "Nike", 0),          # "vintage" allein reicht nicht
    ("Nike ACG Fleece 90s vintage", "Nike", 2),
    ("Levi's 501 Big E Made in USA", "Levi's", 2),
    ("Stone Island Ghost Piece Overshirt", "Stone Island", 1),
    ("Adidas Jacke Made in West Germany", "Adidas", 2),  # bei Adidas ein Sammler-Merkmal
])
def test_rarity_levels(title, brand, level):
    assert rarity(item(1, 10, title=title, brand=brand)).level == level


def test_rarity_raises_value_and_score():
    ref = Reference(75.0, "10 ähnliche", 10)
    plain = item(1, 45, title="Carhartt Jacket", brand="Carhartt", size="M")
    rare_item = item(2, 45, title="Vintage Carhartt Detroit Jacket Made in USA", brand="Carhartt", size="M")
    a = score_item(plain, ref, now=NOW, resale=True)
    b = score_item(rare_item, ref, now=NOW, resale=True, rare=rarity(rare_item))
    assert a.discount == pytest.approx(0.4)
    assert b.discount == pytest.approx(1 - 45 / 105)  # Wert = 75 € + 40 % Raritäten-Aufschlag
    assert b.total > a.total and b.rarity_level == 2
    assert b.reasons[0] == "💎 Rarität: vintage · Made in USA · Detroit"
    alert = Alert(item=rare_item, search_name="x", score=b, buy_url="u", resale=True)
    assert "💎 RARITÄT" in telegram_caption(alert, now=NOW)


# -- Größen & Kategorien --------------------------------------------------------------

def test_size_matching():
    wanted = ["S", "M", "L"]
    assert size_matches("M", wanted) and size_matches("M / 38 / 10", wanted) and size_matches("s", wanted)
    assert not size_matches("XL", wanted) and not size_matches("43", wanted) and not size_matches("164", wanted)
    assert size_matches("W32 | L32", wanted)  # Bundweite 32 ≈ M/L (seit Version 2.1)
    assert size_matches("One size", wanted) and size_matches("", wanted)  # Taschen, Caps …
    assert size_matches("XL", [])  # keine Einschränkung


def test_more_shoe_models_are_recognised():
    for title in ["Nike Shox TL", "Asics Gel-Kayano 14", "New Balance 1906R", "Salomon Speedcross 6",
                  "Nike P-6000", "Adidas Samba OG"]:
        assert product_type(title) == "sneaker", title
    assert resolve_type("Schuhe") == "schuhe" and resolve_type("Sneaker") == "sneaker"
    assert resolve_type("Jeans") == "jeans" and resolve_type("Taschen") == "tasche" and resolve_type("caps") == "muetze"


@pytest.fixture
def mon(tmp_path):
    cfg = config_from_dict({"resale": {"brands": ["Carhartt"], "budget": 500, "budget_brands": 500}},
                           base_dir=str(tmp_path))
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "t.db")), FakeNotifier(), clock=lambda: NOW)
    m.pause_between_searches = (0, 0)
    return m


def test_default_filters_sizes_and_no_shoes(mon):
    s = mon.effective(mon.cfg.searches[0])
    f = mon.global_filters()
    assert f == {"sizes": ["S", "M", "L"], "exclude_types": ["schuhe"], "only_rare": False}
    assert mon.explain(s, item(1, 10, title="Carhartt Sneaker", brand="Carhartt", size="43"), NOW)[1] \
        == "Kategorie ausgeblendet (Schuhe)"
    assert mon.explain(s, item(1, 10, title="Carhartt Jacke", brand="Carhartt", size="XL"), NOW)[1] \
        == "Größe XL passt nicht (S, M, L)"
    # eigene Größen einer Suche haben Vorrang
    own = SearchConfig.resale_for_brand("Carhartt", sizes=["XL"])
    assert "Größe" not in mon.explain(mon.effective(own), item(1, 10, title="Carhartt Jacke", brand="Carhartt",
                                                                size="XL"), NOW)[1]


def test_config_filters_section():
    cfg = config_from_dict({"filters": {"sizes": ["m", "l"], "exclude_types": [], "only_rare": True}})
    assert (cfg.filter_sizes, cfg.filter_exclude_types, cfg.only_rare) == (["M", "L"], [], True)
    assert config_from_dict({"filters": {"sizes": "alle"}}).filter_sizes == []


# -- Telegram: Größe, Kategorien, Raritäten, Preise ------------------------------------

@pytest.fixture
def bot(mon):
    tg = FakeTelegram()
    return TelegramController(tg, mon, None), tg


def test_size_and_category_commands(bot):
    ctl, tg = bot
    mon = ctl.monitor
    ctl.handle_update(msg("/groesse m, xl"))
    assert mon.global_filters()["sizes"] == ["M", "XL"] and "Größen: M, XL" in tg.texts()[-1]
    ctl.handle_update(msg("/groesse alle"))
    assert mon.global_filters()["sizes"] == []
    ctl.handle_update(msg("/groesse standard"))
    assert mon.global_filters()["sizes"] == ["S", "M", "L"]

    ctl.handle_update(msg("/ohne taschen und caps"))
    assert mon.global_filters()["exclude_types"] == ["schuhe", "tasche", "muetze"]
    assert "🚫 <b>Taschen</b>" in tg.texts()[-1] and "✅ <b>Jacken &amp; Mäntel</b>" in tg.texts()[-1]
    assert "◐ <b>Accessoires</b>" in tg.texts()[-1]  # nur Caps aus
    ctl.handle_update(msg("/mit schuhe"))
    assert mon.global_filters()["exclude_types"] == ["tasche", "muetze"]

    ctl.handle_update(msg("/raritaeten an"))
    assert mon.global_filters()["only_rare"] and "Nur Raritäten: an" in tg.texts()[-1]
    s = mon.effective(mon.cfg.searches[0])
    assert mon.explain(s, item(1, 10, title="Carhartt Jacke", brand="Carhartt", size="M"), NOW)[1] == "keine Rarität"
    ctl.handle_update(msg("/raritaeten aus"))
    assert not mon.global_filters()["only_rare"]


def test_teach_own_market_price(bot):
    ctl, tg = bot
    mon = ctl.monitor
    ctl.handle_update(msg("/preis carhartt jacken 120"))
    assert "Carhartt Jacken sind ca. <b>120 €</b>" in tg.texts()[-1]
    s = mon.effective(mon.cfg.searches[0])
    alert, _ = mon.explain(s, item(1, 50, title="Carhartt Jacke", brand="Carhartt WIP", size="M", minutes_old=1), NOW)
    assert alert.score.reference_price == 120 and "dein Marktpreis" in alert.score.reasons[0]
    ctl.handle_update(msg("/preis carhartt jacken weg"))
    assert mon.storage.get_json("own_prices") == {}


# -- Lernen aus 👍 / 👎 ------------------------------------------------------------------

def test_feedback_learning(bot):
    ctl, tg = bot
    mon = ctl.monitor
    st = mon.storage
    caps = [item(10 + i, 5, title="Carhartt Cap", brand="Carhartt", size="One size") for i in range(3)]
    for c in caps:
        st.save_item(c, "muetze")
    kb = telegram_keyboard(Alert(item=caps[0], search_name="x", score=score_item(caps[0], None), buy_url="u"), False)
    assert kb["inline_keyboard"][-1][1]["callback_data"] == "fb:0:10"

    def vote(item_id, positive):
        ctl.handle_update({"update_id": 1, "callback_query": {
            "id": "c", "data": f"fb:{1 if positive else 0}:{item_id}",
            "message": {"chat": {"id": 4711}, "message_id": 1}}})
        return [p["text"] for m, p in tg.calls if m == "answerCallbackQuery"][-1]

    assert "Gemerkt" in vote(10, False)
    assert vote(10, False) == "Schon bewertet – danke!"
    vote(11, False)
    assert "Mützen & Caps blende ich ab jetzt aus" in vote(12, False)  # 3× 👎 -> ausgeblendet
    assert "muetze" in mon.global_filters()["exclude_types"]
    assert mon.preferences()["brand:carhartt"] == -3

    ctl.handle_update(msg("/vorlieben"))
    assert "👎 Mützen &amp; Caps (-3)" in tg.texts()[-1]
    ctl.handle_update(msg("/mit caps"))  # holt sie zurück und vergisst die 👎
    assert "muetze" not in mon.global_filters()["exclude_types"]
    assert "type:muetze" not in mon.preferences()


def test_likes_raise_score(mon):
    s = mon.effective(mon.cfg.searches[0])
    jacket = item(1, 30, title="Carhartt Jacke", brand="Carhartt", size="M", minutes_old=1)
    before = mon.explain(s, jacket, NOW)[0].score.total
    mon.storage.set_json("prefs", {"brand:carhartt": 2, "type:jacke": 1})
    after = mon.explain(s, jacket, NOW)[0]
    assert after.score.total == min(100, before + 9) and "👍 passt zu deinen Vorlieben" in after.score.reasons


# -- Kalibrierung mit Musterdaten ------------------------------------------------------

@pytest.mark.parametrize("seed", range(1, 9))
def test_sample_data_normal_level_finds_everything_and_no_traps(seed):
    r = run_sample(config_from_dict({}), seed=seed, now=NOW)
    assert r.found_finds == r.finds, f"verpasste Finds: {r.finds - r.found_finds}"
    assert r.wrong_alerts == []
    reasons = {i.title: why for i, why in r.rejected}
    assert reasons["Nike Air Max 90"] == "Kategorie ausgeblendet (Schuhe)"
    assert reasons["Stone Island Jacke inspired"] == "Ausschlusswort 'inspired'"
    assert reasons["Jacke im Stone Island Style"] == "andere Marke"
    assert reasons["Carhartt Detroit Jacket"] == "schon 45 Min. online"


@pytest.mark.parametrize("seed", range(1, 5))
def test_sample_data_strict_level_never_reports_traps(seed):
    st = Storage(":memory:")
    st.set_state("resale_level", "streng")
    r = run_sample(config_from_dict({}), source_storage=st, seed=seed, now=NOW)
    assert r.wrong_alerts == []
    assert all(a.score.age_minutes <= 5 and a.score.discount >= 0.5 for a in r.alerts)


def test_probelauf_command(bot):
    ctl, tg = bot
    ctl.handle_update(msg("/probelauf"))
    texts = tg.texts()
    assert "Echte Finds im Datensatz erkannt: 13 von 13" in texts[1]
    demo = [p for m, p in tg.calls if m == "sendMessage" and "PROBELAUF" in p["text"]]
    assert len(demo) == 3 and all("reply_markup" not in p for p in demo)  # keine echten Links/Buttons


def test_brand_dislikes_hide_brand(mon):
    for i, title in enumerate(["Nike Jacke", "Nike Hoodie", "Nike T-Shirt"]):
        mon.storage.save_item(item(50 + i, 10, title=title, brand="Nike", size="M"), product_type(title))
    msgs = [mon.record_feedback(50 + i, False) for i in range(3)]
    assert "Nike sortiere ich ab jetzt aus" in msgs[-1]
    s = mon.effective(SearchConfig.resale_for_brand("Nike"))
    assert mon.explain(s, item(60, 5, title="Nike Pullover", brand="Nike", size="M"), NOW)[1] == "von dir aussortiert (👎)"
