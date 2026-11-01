from conftest import NOW, item
from vinted_bot.config import DEFAULT_EXCLUDE_WORDS, SearchConfig
from vinted_bot.scoring import condition_points, passes_filters, reference_price, score_item, suggest_offers


def s(**kw):
    return SearchConfig(name="t", keywords="x", **kw)


def test_exclude_words_use_word_boundaries():
    assert passes_filters(item(1, 20, title="Nike Air Max FAKE"), s(), DEFAULT_EXCLUDE_WORDS)[0] is False
    assert passes_filters(item(1, 20, title="Suche Air Max 90"), s(), DEFAULT_EXCLUDE_WORDS)[0] is False
    # "rep" darf nicht in "Reparatur-frei" oder "Repton" anschlagen
    assert passes_filters(item(1, 20, title="Repton Jacke"), s(), DEFAULT_EXCLUDE_WORDS)[0] is True
    assert passes_filters(item(1, 20, title="Schuhe defekt"), s(), DEFAULT_EXCLUDE_WORDS)[0] is False


def test_price_brand_size_and_must_contain_filters():
    assert passes_filters(item(1, 90), s(max_price=80), [])[1] == "zu teuer"
    assert passes_filters(item(1, 5), s(min_price=10), [])[1] == "zu billig"
    assert passes_filters(item(1, 20, brand="Adidas", title="Samba"), s(brands=["Nike"]), [])[0] is False
    assert passes_filters(item(1, 20, brand="Nike"), s(brands=["nike"]), [])[0] is True
    assert passes_filters(item(1, 20, size="M / 38 / 10"), s(sizes=["M"]), [])[0] is True
    assert passes_filters(item(1, 20, size="L"), s(sizes=["M", "S"]), [])[0] is False
    assert passes_filters(item(1, 20, title="Air Max 95"), s(must_contain=["90"]), [])[0] is False
    assert passes_filters(item(1, 20, title="Air Max 90"), s(must_contain=["air", "90"]), [])[0] is True


def test_reference_price():
    assert reference_price(50, [10, 20]) == 50
    assert reference_price(None, [10, 20]) is None  # zu wenig Daten
    assert reference_price(None, [10, 20, 30, 40, 50, 60, 70, 80, 90]) == 50


def test_condition_points_prefers_specific_match():
    assert condition_points("Neu mit Etikett") == 20
    assert condition_points("Sehr gut") == 14
    assert condition_points("Gut") == 9
    assert condition_points("") == 8


def test_score_bargain_vs_overpriced():
    cheap = score_item(item(1, 20, minutes_old=1, status="Neu mit Etikett"), 40, top_threshold=75, now=NOW)
    pricey = score_item(item(2, 60, minutes_old=90, status="Gut"), 40, top_threshold=75, now=NOW)
    unknown = score_item(item(3, 20), None, now=NOW)
    assert cheap.total == 90 and cheap.is_top
    assert "50% unter Marktpreis" in cheap.reasons[0]
    assert pricey.total < 20 and not pricey.is_top
    assert "über Marktpreis" in pricey.reasons[0]
    assert unknown.reference_price is None and 30 < unknown.total < 60


def test_popular_fresh_item_gets_bonus():
    calm = score_item(item(1, 30, favs=0), 30, now=NOW)
    hot = score_item(item(2, 30, favs=6), 30, now=NOW)
    assert hot.total - calm.total == 10
    assert any("Favoriten" in r for r in hot.reasons)


def test_suggest_offers_respects_vinted_limit():
    assert suggest_offers(30, [10, 20]) == [27.0, 24.0]
    assert suggest_offers(30, [50]) == [18.0]  # max. 40 % Nachlass
    assert suggest_offers(3, [10, 20]) == [2.0]  # keine doppelten / sinnlosen Angebote
