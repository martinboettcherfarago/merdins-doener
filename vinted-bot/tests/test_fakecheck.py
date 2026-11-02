"""🛡 Fake-Ampel: sofortiger Fake-Check ohne Training – und wie der Bot damit umgeht."""

import pytest

from conftest import NOW, FakeNotifier, item
from test_ai_workers import make_reviewer, verdict
from test_telegram import FakeTelegram, msg
from vinted_bot.brain import Tag
from vinted_bot.config import ConfigError, SearchConfig, config_from_dict
from vinted_bot.fakecheck import brand_risk, check
from vinted_bot.models import Item
from vinted_bot.monitor import Monitor
from vinted_bot.notify import telegram_caption
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController


def test_luxury_bag_far_too_cheap_and_new_is_red():
    it = Item(1, "Louis Vuitton Neverfull MM", 45, brand="Louis Vuitton", condition="Neu mit Etikett")
    c = check(it, "Louis Vuitton", "tasche", 0.93, "luxus")
    assert c.level == "rot" and c.risk >= 0.65
    assert "sehr billig für Louis Vuitton (LV-Klassiker)" in c.line()
    assert "„neu mit Etikett“ zum Spottpreis" in c.reasons


@pytest.mark.parametrize("title", ["Moncler Maya 1:1", "Stone Island Pullover AAA", "Jordan 4 UA quality",
                                   "Gucci Gürtel mirror quality", "Prada Tasche nicht original",
                                   "Dior Saddle Bag inspired", "Weiß nicht ob echt – Chanel Kette"])
def test_giveaway_words_are_red_for_any_price(title):
    c = check(Item(2, title, 80), "", "sonstiges", 0.0)
    assert c.level == "rot", (title, c)


def test_normal_items_stay_green_and_quiet():
    for title, brand, ptype, disc in [("Carhartt Detroit Jacke vintage", "Carhartt", "jacke", 0.5),
                                      ("Spiderman T-Shirt", "", "tshirt", 0.0),
                                      ("Vintage Adidas Trainingsjacke 90er", "Adidas", "jacke", 0.6),
                                      ("Levi's 501 Vintage Jeans", "Levi's", "jeans", 0.6)]:
        c = check(Item(3, title, 20, brand=brand), brand, ptype, disc)
        assert c.level == "grün" and not c.visible, (title, c)


def test_hype_sneaker_too_cheap_is_yellow():
    it = Item(4, "Nike Air Jordan 1 High Chicago", 60, brand="Nike", condition="Neu mit Etikett")
    c = check(it, "Nike", "sneaker", 0.7, "sport")
    assert c.level == "gelb" and "Jordan 1/4/11" in c.line()
    # die Marke wird auch im Titel erkannt, wenn sie fehlt ("Andere")
    assert brand_risk("", "daunenjacke", None, "Moncler Daunenjacke")[0] >= 0.9
    assert brand_risk("", "tshirt", None, "Spiderman Shirt")[0] == 0


def test_stock_photo_and_own_fake_model_raise_risk_proof_lowers_it():
    it = Item(5, "Gucci Gürtel", 30, brand="Gucci")
    base = check(it, "Gucci", "guertel", 0.88, "luxus")
    stock = check(it, "Gucci", "guertel", 0.88, "luxus", tags=[Tag("foto", "Produktfoto", 0.9)])
    assert base.level == "gelb" and stock.risk > base.risk and stock.level == "rot"
    assert "Katalog-/Stockfoto statt eigenem Foto" in stock.reasons
    proof = check(Item(6, "Gucci Gürtel mit Rechnung", 30, brand="Gucci"), "Gucci", "guertel", 0.88, "luxus")
    assert proof.risk < base.risk
    model = check(Item(7, "Adidas Jacke", 20, brand="Adidas"), "Adidas", "jacke", 0.2, model_fake=0.9)
    assert model.level == "rot" and "eigenes Fake-Modell 90%" in model.reasons


def test_config_options(tmp_path):
    cfg = config_from_dict({}, base_dir=str(tmp_path))
    assert cfg.fake_ampel == "streng" and cfg.ml_backbone == "fashion"
    cfg = config_from_dict({"filters": {"fake_ampel": False}, "ml": {"backbone": "schnell"}}, base_dir=str(tmp_path))
    assert cfg.fake_ampel == "aus" and cfg.ml_backbone == "schnell"
    with pytest.raises(ConfigError):
        config_from_dict({"filters": {"fake_ampel": "egal"}}, base_dir=str(tmp_path))
    with pytest.raises(ConfigError):
        config_from_dict({"ml": {"backbone": "riesig"}}, base_dir=str(tmp_path))


# -- Einbindung in die Suche ---------------------------------------------------------------

@pytest.fixture
def mon(tmp_path):
    cfg = config_from_dict({"resale": {"brands": ["Stone Island"], "level": "locker"}}, base_dir=str(tmp_path))
    from conftest import FakeClient
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "f.db")), FakeNotifier(), clock=lambda: NOW)
    m.pause_between_searches = (0, 0)
    return m


def suspicious(i=1):
    return item(i, 25, title="Stone Island Pullover top qualität alle größen verfügbar", brand="Stone Island",
                size="M", status="Neu mit Etikett", minutes_old=2)


def test_red_is_dropped_in_strict_mode(mon):
    s = mon.effective(SearchConfig.watch("Stone Island"))
    alert, why = mon.explain(s, suspicious(), NOW)
    assert alert is None and why.startswith("Fake-Ampel rot") and "alle Größen verfügbar" in why


def test_warn_mode_reports_with_warning_line(mon):
    mon.storage.set_state("fake_ampel", "warnen")
    s = mon.effective(SearchConfig.watch("Stone Island"))
    alert, why = mon.explain(s, suspicious(), NOW)
    assert alert is not None, why
    cap = telegram_caption(alert, now=NOW)
    assert "🛡 Fake-Ampel: 🔴 hohes Fake-Risiko" in cap and len(cap) <= 1024
    mon.storage.set_state("fake_ampel", "aus")
    alert, _ = mon.explain(s, suspicious(), NOW)
    assert alert is None or alert.ampel is None


def test_red_goes_to_claude_and_is_only_sent_if_it_looks_real(mon):
    mon.reviewer, api = make_reviewer(mon.storage, [verdict(echtheit="unklar"),
                                                    verdict(echtheit="wahrscheinlich_echt")])
    mon.client.pages = [[], [suspicious(1)], [suspicious(2)]]
    mon.run_once()
    mon.run_once()
    assert mon.notifier.alerts == [] and len(api.calls) == 1        # rot + KI unsicher -> nicht melden
    assert "Warnzeichen laut Fake-Ampel" in api.calls[0]["messages"][0]["content"][-1]["text"]
    mon.run_once()
    assert len(mon.notifier.alerts) == 1                             # rot, aber KI: wirkt echt -> melden
    assert mon.notifier.alerts[0].ai.echtheit == "wahrscheinlich_echt"


def test_ampel_command_and_value_check(tmp_path):
    cfg = config_from_dict({}, base_dir=str(tmp_path))
    tg = FakeTelegram()
    from conftest import FakeClient
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "t.db")), FakeNotifier(), clock=lambda: NOW)
    ctl = TelegramController(tg, m, None)
    ctl.handle_update(msg("/ampel warnen"))
    assert m.ampel_mode() == "warnen" and "Fake-Ampel: warnen" in tg.texts()[-1]
    ctl.handle_update(msg("/ampel"))
    assert "Fake-Ampel: warnen" in tg.texts()[-1]
    ctl.handle_update(msg("/wert louis vuitton speedy tasche 40 €"))
    assert "🛡 Fake-Ampel: 🔴" in tg.texts()[-1]
    ctl.handle_update(msg("/wert carhartt detroit jacke 30 €"))
    assert "Fake-Ampel" not in tg.texts()[-1]
