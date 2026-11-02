"""Version 2: Preisschätzung für (fast) alles, Trend-Suchen, Alles-Radar, Fake-Schutz, keine Doppelmeldungen."""

import pytest

from conftest import NOW, FakeClient, FakeNotifier, item
from test_telegram import FakeTelegram, msg
from vinted_bot.catalog import CATEGORIES, brand_info, detect_brand, estimate, product_type
from vinted_bot.config import SearchConfig, config_from_dict, watch_name
from vinted_bot.knowledge import estimate_item, trend_match
from vinted_bot.monitor import Monitor
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController


# -- Preisschätzung ---------------------------------------------------------------------

@pytest.mark.parametrize("title,brand,low,high", [
    ("Carhartt WIP Detroit Jacket", "Carhartt WIP", 50, 120),
    ("Zara Kleid", "Zara", 4, 15),
    ("Miu Miu Tasche", "Miu Miu", 250, 800),
    ("Moncler Daunenjacke", "Moncler", 250, 900),
    ("Vintage Lederjacke", "", 20, 60),
    ("Nintendo DS Lite", "", 30, 120),
    ("Lego Star Wars Set", "", 15, 60),
    ("Polo Ralph Lauren Pullover", "Polo Ralph Lauren", 20, 60),
    ("Dior Sauvage Eau de Parfum", "Dior", 15, 60),
    ("H&M T-Shirt", "H&M", 2, 8),
])
def test_estimates_are_plausible(title, brand, low, high):
    e = estimate(title, brand, "Sehr gut", "M")
    assert low <= e.value <= high, (title, e.value, e.basis)


def test_every_category_has_an_estimate():
    for key, cat in CATEGORIES.items():
        e = estimate(f"Artikel {cat.label}", "", ptype=key)
        assert e.value > 0 and e.confidence in ("mittel", "niedrig")


def test_condition_kids_and_brand_detection():
    new = estimate("Stüssy Hoodie", "Stüssy", "Neu mit Etikett", "M")
    worn = estimate("Stüssy Hoodie", "Stüssy", "Zufriedenstellend", "M")
    assert new.value / worn.value == pytest.approx(1.35 / 0.6)
    kids = estimate("Nike Jacke", "Nike", "Sehr gut", "140")
    adult = estimate("Nike Jacke", "Nike", "Sehr gut", "M")
    assert kids.value == pytest.approx(adult.value * 0.45) and "Kindergröße" in kids.factor_notes[-1]
    # ohne Markenangabe wird die Marke im Titel gesucht
    e = estimate_item(item(1, 10, title="Vintage Stone Island Pullover", brand=""))
    assert e.brand == "Stone Island" and e.tier == "designer"
    assert detect_brand("tnf nuptse 700") == "The North Face"
    assert detect_brand("jacke von only") is None  # zu allgemeine Wörter zählen nicht
    assert brand_info("Polo Ralph Lauren")[1] == "premium" and brand_info("Unbekannt") is None


def test_more_categories_are_recognised():
    assert product_type("Nike Blazer Mid") == "sneaker"
    assert product_type("Hugo Boss Sakko") == "blazer"
    assert product_type("The North Face Nuptse") == "daunenjacke"
    assert product_type("Pokemon Karten Sammlung") == "sammelkarten"
    assert product_type("Mario Kart 8 Switch") == "videospiel"
    assert product_type("iPhone 12 Hülle") == "zubehoer"
    assert product_type("Vintage Fußballtrikot 1998") == "trikot"
    assert product_type("Rock Band T-Shirt") == "tshirt"


def test_trend_detection():
    assert trend_match("Nike Tech Fleece Jacke") == "Tech Fleece"
    assert trend_match("Vintage Bayern Trikot 1998") == "Retro-Trikot"
    assert trend_match("Normale Jacke") is None


# -- Monitor: nichts wird mehr wegen "Marktpreis unbekannt" aussortiert -----------------

@pytest.fixture
def mon(tmp_path):
    cfg = config_from_dict({"resale": {"brands": ["Carhartt"], "keywords": ["Vintage Lederjacke"],
                                       "budget": 500, "budget_brands": 500}},
                           base_dir=str(tmp_path))
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "v2.db")), FakeNotifier(), clock=lambda: NOW)
    m.pause_between_searches = (0, 0)
    return m


def test_no_learning_phase_needed(mon):
    # Marke ohne eigene Preistabelle und ohne einen einzigen gelernten Preis -> trotzdem bewertet
    s = mon.effective(SearchConfig.watch("Acne Studios"))
    alert, why = mon.explain(s, item(1, 25, title="Acne Studios Pullover", brand="Acne Studios", size="M",
                                     minutes_old=1), NOW)
    assert alert is not None, why
    assert "Schätzung: Pullover von Designer-Marken" in alert.score.reasons[0]
    si = mon.explain(mon.effective(SearchConfig.watch("Stone Island")),
                     item(2, 40, title="Stone Island Pullover", brand="Stone Island", size="M", minutes_old=1), NOW)[0]
    assert "Schätzung: Preiswissen Stone Island Pullover" in si.score.reasons[0]


def test_unknown_brand_needs_bigger_discount(mon):
    s = mon.effective(SearchConfig.watch("Vintage Lederjacke"))
    ok = mon.explain(s, item(1, 9, title="Lederjacke schwarz", brand="", size="M", minutes_old=1), NOW)[0]
    meh = mon.explain(s, item(2, 18, title="Lederjacke schwarz", brand="", size="M", minutes_old=1), NOW)
    assert ok is not None and ok.score.confidence == "niedrig"
    assert meh[0] is None and "unsichere Schätzung" in meh[1]  # 45 % reicht bei No-Name nicht


def test_fake_suspicion(mon):
    s = mon.effective(SearchConfig.watch("Miu Miu"))
    fake = mon.explain(s, item(1, 30, title="Miu Miu Tasche", brand="Miu Miu", size="", minutes_old=1), NOW)
    assert fake == (None, "Fake-Verdacht (viel zu billig für die Marke)")
    real = mon.explain(s, item(2, 150, title="Miu Miu Tasche", brand="Miu Miu", size="", minutes_old=1), NOW)[0]
    assert real is not None and not real.score.fake_suspect


def test_trend_bonus_in_alert(mon):
    s = mon.effective(SearchConfig.watch("Carhartt"))
    a = mon.explain(s, item(1, 30, title="Carhartt Detroit Jacket", brand="Carhartt WIP", size="M",
                            minutes_old=1), NOW)[0]
    assert a.score.rarity_level == 1 and "💎 Rarität: Detroit" in a.score.reasons
    assert "🔥 Trend: Carhartt Detroit" in a.score.reasons


def test_alles_radar_only_wanted_brands(mon):
    radar = mon.effective(SearchConfig.from_dict({"name": "Alles-Radar", "sweep": True, "mode": "resale"}))
    assert radar.keywords is None and radar.sweep
    noname = mon.explain(radar, item(1, 3, title="Pullover", brand="", size="M", minutes_old=1), NOW)
    assert noname == (None, "Alles-Radar: keine gefragte Marke")
    hm = mon.explain(radar, item(2, 3, title="H&M Pullover", brand="H&M", size="M", minutes_old=1), NOW)
    assert hm == (None, "Alles-Radar: keine gefragte Marke")
    good = mon.explain(radar, item(3, 20, title="Arc'teryx Fleece", brand="Arc'teryx", size="M", minutes_old=1),
                       NOW)[0]
    assert good is not None


def test_no_duplicate_alerts_across_searches(tmp_path):
    cfg = config_from_dict({"resale": {"brands": ["Carhartt"], "keywords": ["Carhartt Jacke"]}},
                           base_dir=str(tmp_path))
    client, notifier = FakeClient(), FakeNotifier()
    m = Monitor(cfg, client, Storage(str(tmp_path / "d.db")), notifier, clock=lambda: NOW)
    m.pause_between_searches = (0, 0)
    deal = item(1, 20, title="Carhartt Jacke", brand="Carhartt WIP", size="M", minutes_old=1)
    client.pages = [[], [], [deal], [deal]]  # beide Suchen finden denselben Artikel
    m.run_once()
    m.run_once()
    assert [a.item.id for a in notifier.alerts] == [1]


def test_old_names_are_migrated(tmp_path, clock):
    st = Storage(str(tmp_path / "old.db"))
    st.add_search(SearchConfig.from_dict({"name": "Resale · Carhartt", "keywords": "Carhartt", "mode": "resale"},
                                         source="telegram"))
    st.set_state("seeded:Resale · Carhartt", "1")
    st.set_state("disabled:Resale · Stüssy", "1")  # Suche aus der config.yaml
    st.add_price("Resale · Carhartt", 50, "b:carhartt|jacke")
    Monitor(config_from_dict({}), FakeClient(), st, FakeNotifier(), clock=clock)
    assert [s.name for s in st.custom_searches()] == ["Marke · Carhartt"]
    assert st.is_seeded("Marke · Carhartt") and st.is_disabled("Marke · Stüssy")
    assert st.price_history("Marke · Carhartt") == [50]
    assert watch_name("Vintage Lederjacke") == "Trend · Vintage Lederjacke"


# -- Telegram: /wert und /radar ------------------------------------------------------------

@pytest.fixture
def bot(mon):
    tg = FakeTelegram()
    return TelegramController(tg, mon, None), tg


def test_value_command(bot):
    ctl, tg = bot
    ctl.handle_update(msg("/wert vintage carhartt detroit jacke made in usa 40€"))
    text = tg.texts()[-1]
    assert "Geschätzter Wert: ca." in text and "Marke: Carhartt" in text
    assert "Kategorie: Jacken" in text and "💎 Rarität" in text and "unter Wert" in text
    ctl.handle_update(msg("/wert https://www.vinted.de/items/123456-stone-island-pullover-l"))
    assert "Stone Island (Designer)" in tg.texts()[-1] and "Pullover" in tg.texts()[-1]


def test_radar_command(bot):
    """/radar steuert jetzt den ⚡ Sniper (neueste Uploads alle paar Sekunden statt einmal pro Runde)."""
    ctl, tg = bot
    ctl.handle_update(msg("/radar aus"))
    assert not ctl.monitor.sniper_enabled() and "Sniper aus" in tg.texts()[-1]
    ctl.handle_update(msg("/radar an https://www.vinted.de/catalog/2050-herren-jacken"))
    assert ctl.monitor.sniper_enabled() and "Sniper: an" in tg.texts()[-1] and "in deiner Kategorie" in tg.texts()[-1]
    sniper = ctl.monitor.sniper_search()
    assert sniper.sweep and sniper.url.endswith("2050-herren-jacken") and sniper.max_price == 500
    ctl.handle_update(msg("/radar"))
    assert "Sniper: an" in tg.texts()[-1]
    assert all(not s.sweep for s in ctl.monitor.active_searches())   # läuft nicht mehr in der langen Runde


# -- Jeans: Bundweiten, Schnitte, Levi's ------------------------------------------------

def test_jeans_sizes_pass_the_letter_size_filter():
    from vinted_bot.knowledge import size_matches
    for size in ["W30 L32", "W32 | L32", "30/32", "38", "M / 38 / 10", "48"]:
        assert size_matches(size, ["S", "M", "L"]), size
    for size in ["W38 L34", "164", "43", "XL"]:
        assert not size_matches(size, ["S", "M", "L"]), size
    assert size_matches("W32 L34", ["W32"])  # eigene Bundweite geht auch


def test_jeans_cuts_and_trends():
    assert product_type("Levi's 517 Bootcut") == "jeans"
    assert product_type("Y2K Low Rise Flared Jeans") == "jeans"
    assert trend_match("Levi's 517 Bootcut") == "Bootcut/Flared"


def test_vintage_levis_bootcut_is_found(mon):
    s = mon.effective(SearchConfig.watch("Vintage Levi's"))
    assert s.keywords == "Vintage Levi's" and s.brands == ["Levi's"]
    jeans = item(1, 9, title="Vintage Levi's 517 Bootcut Y2K", brand="Levi's", size="W30 L32", minutes_old=2)
    alert, why = mon.explain(s, jeans, NOW)
    assert alert is not None, why
    assert alert.score.rarity_level == 1 and alert.score.trend in ("Y2K", "Bootcut/Flared")


# -- Kleinkram & Bücher raus, neue Trends rein (Version 2.2) ------------------------------

@pytest.mark.parametrize("title,why", [
    ("Carhartt WIP Logo Patch für Jacken", "Kleinkram: Patches, Sticker & Anstecker – kein Kleidungsstück"),
    ("Stüssy Sticker Set", "Kleinkram: Patches, Sticker & Anstecker – kein Kleidungsstück"),
    ("Carhartt Staubbeutel", "Kleinkram: Verpackung, Etiketten & Staubbeutel – kein Kleidungsstück"),
    ("Carhartt Katalog 2019", "Buch/Medien: Bücher – kein Kleidungsstück"),
    ("Carhartt Jacke", "unter 2 € (meist Lockangebot oder Kleinkram)"),
])
def test_patches_stickers_books_are_not_deals(mon, title, why):
    s = mon.effective(SearchConfig.watch("Carhartt"))
    price = 1 if title == "Carhartt Jacke" else 3
    assert mon.explain(s, item(1, price, title=title, brand="Carhartt", size="M", minutes_old=1), NOW) == (None, why)


def test_patchwork_is_clothing_and_explicit_sticker_search_works(mon):
    s = mon.effective(SearchConfig.watch("Carhartt"))
    a = mon.explain(s, item(1, 20, title="Carhartt Patchwork Jacke", brand="Carhartt", size="M", minutes_old=1), NOW)
    assert a[0] is not None, a[1]
    stickers = SearchConfig(name="Sticker", keywords="supreme sticker")  # wer Sticker sucht, bekommt Sticker
    assert "Kleinkram" not in mon.explain(stickers, item(2, 3, title="Supreme Sticker", brand="Supreme"), NOW)[1]
    books = SearchConfig(name="Bücher", keywords="harry potter buch")
    assert "Buch/Medien" not in mon.explain(books, item(3, 3, title="Harry Potter Buch"), NOW)[1]


def test_new_trends_tops_and_fur_jackets(mon):
    from vinted_bot.config import TREND_WATCHES
    for entry in ["Abercrombie & Fitch", "Fellkragen Jacke", "Y2K Top", "Korsett Top", "Brandy Melville",
                  "Lululemon", "Y2K Cargo", "Y2K Minirock"]:
        assert entry in TREND_WATCHES
    assert trend_match("Abercrombie & Fitch Y2K Jacke mit Fellkragen") == "Abercrombie Y2K"
    assert trend_match("Spitzen Top weiß Y2K") == "Spitzen-Top"
    assert product_type("Korsett Top schwarz") == "top" and product_type("Vintage Lammfelljacke") == "lederjacke"
    s = mon.effective(SearchConfig.watch("Abercrombie & Fitch"))
    a, why = mon.explain(s, item(1, 15, title="Abercrombie & Fitch Y2K Jacke mit Fellkragen",
                                 brand="Abercrombie & Fitch", size="S", minutes_old=2), NOW)
    assert a is not None, why
    assert a.score.trend == "Abercrombie Y2K" and a.score.value > 50


# -- Version 2.3: Aussortier-Mechanismen überprüft, Retro/90er, Adidas ---------------------

AUDIT = [  # (Suche, Titel, Marke im Feld, Preis, Größe) – alles echte Schnäppchen, die gemeldet werden müssen
    ("Carhartt", "Carhartt WIP Jacke neu mit Etikett", "Carhartt WIP", 20, "M"),
    ("Stone Island", "Stone Island Pullover mit Badge", "Stone Island", 30, "L"),
    ("Miu Miu", "Miu Miu Tasche mit Staubbeutel", "Miu Miu", 150, ""),
    ("Carhartt", "Carhartt Hoodie mit Logo Patch", "Carhartt WIP", 12, "M"),
    ("Stone Island", "Stone Island Jacke 100% original kein Fake", "Stone Island", 60, "M"),
    ("Carhartt", "Carhartt Jacke kein Tausch", "Carhartt WIP", 20, "M"),
    ("Carhartt", "Carhartt Jacke Tausch möglich", "Carhartt WIP", 20, "M"),
    ("Carhartt", "Carhartt Jacke nicht defekt", "Carhartt WIP", 20, "M"),
    ("Adidas", "Adidas Trainingsjacke vintage 90er", "Vintage", 12, "L"),       # Marke "Vintage" gewählt
    ("Vintage Adidas", "Vintage Adidas Trainingsjacke 90s", "Andere", 12, "M"),  # Marke "Andere" gewählt
    ("Vintage Levi's", "Levi's 501 vintage 90er", "Levi's", 10, "W31 L32"),
    ("Vintage 90er", "Vintage 90er Windbreaker", "", 6, "L"),
    ("Vintage Jeans", "Vintage Wrangler Jeans 90er Made in USA", "Wrangler", 9, "W30 L32"),
    ("Vintage Sweatshirt", "Vintage Champion Reverse Weave Sweatshirt 90s", "Champion", 9, "M"),
    ("Tommy Hilfiger vintage", "Vintage Tommy Hilfiger Jacke 90er", "Tommy Hilfiger", 12, "L"),
]


@pytest.mark.parametrize("watch,title,brand,price,size", AUDIT)
def test_good_items_are_no_longer_dropped(mon, watch, title, brand, price, size):
    s = mon.effective(SearchConfig.watch(watch))
    alert, why = mon.explain(s, item(1, price, title=title, brand=brand, size=size, minutes_old=2), NOW)
    assert alert is not None, f"{title}: {why}"


@pytest.mark.parametrize("watch,title,brand,price,size,why", [
    ("Carhartt", "Suche Carhartt Jacke", "Carhartt WIP", 20, "M", "Ausschlusswort 'suche'"),
    ("Carhartt", "Carhartt Jacke nur Tausch", "Carhartt WIP", 20, "M", "Ausschlusswort 'tausch'"),
    ("Carhartt", "Carhartt Jacke defekt", "Carhartt WIP", 20, "M", "Ausschlusswort 'defekt'"),
    ("Stone Island", "Stone Island Jacke fake", "Stone Island", 30, "M", "Ausschlusswort 'fake'"),
    ("Carhartt", "Carhartt WIP Logo Patch für Jacken", "Carhartt WIP", 3, "",
     "Kleinkram: Patches, Sticker & Anstecker – kein Kleidungsstück"),
    ("Stone Island", "Jacke im Stone Island Style", "Vintage", 30, "M", "andere Marke"),
    ("Carhartt", "Jacke wie Carhartt", "No Name", 10, "M", "andere Marke"),
])
def test_bad_items_are_still_dropped(mon, watch, title, brand, price, size, why):
    s = mon.effective(SearchConfig.watch(watch))
    assert mon.explain(s, item(1, price, title=title, brand=brand, size=size, minutes_old=2), NOW) == (None, why)


def test_retro_and_adidas_are_in_the_trend_list():
    from vinted_bot.catalog import is_retro
    from vinted_bot.config import TREND_WATCHES
    for entry in ["Adidas", "Vintage Adidas", "Vintage 90er", "Vintage Jeans", "90er Jeans", "Vintage Windbreaker"]:
        assert entry in TREND_WATCHES
    assert is_retro("Vintage 90er Windbreaker") and is_retro("80s Jacke") and not is_retro("Jacke schwarz")
    assert product_type("Adidas Trainingsjacke vintage") == "jacke"  # Trainingsjacken sind Jacken (Wert!)
    assert trend_match("Puma Windbreaker") == "Windbreaker"
