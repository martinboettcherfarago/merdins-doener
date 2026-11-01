import pytest

from conftest import NOW, raw_item
from vinted_bot.config import SearchConfig
from vinted_bot.models import parse_item
from vinted_bot.vinted import (VintedBlocked, VintedClient, VintedRateLimited, parse_cookie_string,
                               query_for_search, query_from_url)

BASE = "https://www.vinted.de"


def test_query_from_browser_url():
    url = ("https://www.vinted.de/catalog?search_text=air%20max&brand_ids[]=53&brand_ids[]=14"
           "&size_ids[]=207&status_ids[]=2&catalog[]=1231&price_to=40&currency=EUR&order=relevance&time=123")
    q = query_from_url(url)
    assert q.search_text == "air max"
    assert q.price_to == 40
    assert q.filters == {"brand": ["53", "14"], "size": ["207"], "status": ["2"], "catalog": ["1231"]}

    legacy = q.legacy_params(per_page=48)
    assert legacy["brand_ids"] == "53,14"
    assert legacy["catalog_ids"] == "1231"
    assert legacy["status_ids"] == "2"
    assert legacy["order"] == "newest_first"  # immer die neuesten zuerst
    assert legacy["price_to"] == "40"
    assert legacy["currency"] == "EUR"
    assert "time" not in legacy

    edge = q.edge_params(per_page=48)
    assert edge["attribute_ids[brand]"] == "53,14"
    assert edge["attribute_ids[catalog]"] == "1231"


def test_query_from_category_path_and_old_param_names():
    q = query_from_url("https://www.vinted.de/catalog/79-pullover?status[]=6&color_id[]=1")
    assert q.filters == {"status": ["6"], "color": ["1"], "catalog": ["79"]}


def test_query_for_search_overrides():
    s = SearchConfig(name="x", url="https://www.vinted.de/catalog?search_text=jacke&brand_ids[]=362",
                     keywords="carhartt jacke", max_price=60)
    q = query_for_search(s, "EUR")
    assert q.search_text == "carhartt jacke"
    assert q.price_to == 60
    assert q.filters["brand"] == ["362"]
    assert q.legacy_params(48)["currency"] == "EUR"


def test_parse_item_new_and_old_format():
    new = parse_item(raw_item(1, 25.0), BASE)
    old = parse_item(raw_item(2, 25.0, new_format=False), BASE)
    for it in (new, old):
        assert it.price == 25.0
        assert it.total_price == 26.5
        assert it.currency == "EUR"
        assert it.brand == "Nike"
        assert it.condition == "Sehr gut"
        assert it.created_ts == NOW - 120
        assert it.seller_id is not None
    assert new.buy_url(BASE) == f"{BASE}/transaction/buy/new?source_screen=item&transaction%5Bitem_id%5D=1"


def test_parse_item_item_box_fallback_and_relative_path():
    raw = {"id": 5, "title": "Pulli", "price": {"amount": "10.0", "currency_code": "EUR"},
           "path": "/items/5-pulli", "content_source": "search",
           "item_box": {"first_line": "Zara", "second_line": "M · Gut"}}
    it = parse_item(raw, BASE)
    assert it.url == f"{BASE}/items/5-pulli"
    assert (it.brand, it.size, it.condition) == ("Zara", "M", "Gut")
    assert parse_item({"id": 6, "title": "kaputt"}, BASE) is None  # ohne Preis


def test_parse_cookie_string():
    assert parse_cookie_string("a=1; access_token_web=x=y; ;b = 2") == {"a": "1", "access_token_web": "x=y", "b": "2"}


class Resp:
    def __init__(self, status, data=None, headers=None, text=False):
        self.status_code = status
        self._data = data
        self.headers = headers or {}
        self._text = text

    def json(self):
        if self._text:
            raise ValueError("no json")
        return self._data


class FakeSession:
    def __init__(self, responses):
        self.responses = responses  # gemeinsame Warteschlange über neue Sitzungen hinweg
        self.calls = []

    def get(self, url, params=None, **kw):
        self.calls.append((url, params))
        return self.responses.pop(0)


def make_client(monkeypatch, responses):
    client = VintedClient("de")
    sessions = []
    responses = list(responses)

    def new_session():
        s = FakeSession(responses)
        sessions.append(s)
        return s

    monkeypatch.setattr(client, "_new_session", new_session)
    return client, sessions


def test_client_search_ok(monkeypatch):
    client, sessions = make_client(monkeypatch, [Resp(200, {"items": [raw_item(1, 20), raw_item(2, 30), "x"]})])
    items = client.search(query_from_url("https://www.vinted.de/catalog?search_text=nike"))
    assert [i.id for i in items] == [1, 2]
    url, params = sessions[0].calls[0]
    assert url == "https://www.vinted.de/api/v2/catalog/items"
    assert params["search_text"] == "nike"


def test_client_switches_to_new_api_on_404(monkeypatch):
    client, sessions = make_client(monkeypatch, [Resp(404), Resp(200, {"items": [raw_item(1, 20)]})])
    items = client.search(query_from_url("https://www.vinted.de/catalog?search_text=nike&brand_ids[]=53"))
    assert len(items) == 1
    url, params = sessions[0].calls[1]
    assert url == "https://api.vinted.de/svc-catalogue/items"
    assert params["attribute_ids[brand]"] == "53"


def test_client_refreshes_session_on_401(monkeypatch):
    client, sessions = make_client(monkeypatch, [Resp(401), Resp(200, {"items": []})])
    assert client.search(query_from_url("https://www.vinted.de/catalog?search_text=a")) == []
    assert len(sessions) == 2  # neue Sitzung nach 401


def test_client_rate_limit_and_block(monkeypatch):
    client, _ = make_client(monkeypatch, [Resp(429, headers={"Retry-After": "120"})])
    with pytest.raises(VintedRateLimited) as e:
        client.search(query_from_url("https://www.vinted.de/catalog?search_text=a"))
    assert e.value.retry_after == 120

    client, _ = make_client(monkeypatch, [Resp(200, text=True)] * 3)
    with pytest.raises(VintedBlocked):
        client.search(query_from_url("https://www.vinted.de/catalog?search_text=a"))


def test_example_config_is_valid():
    import os
    from vinted_bot.config import load_config
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.example.yaml")
    cfg = load_config(path)
    assert cfg.domain == "de" and cfg.web_base == "https://www.vinted.de"
    names = [s.name for s in cfg.searches]
    assert names[:3] == ["Air Max 90", "Carhartt Jacken", "Levi's 501"]
    assert "Resale · Stone Island" in names and len(names) == 3 + 17
    resale = cfg.searches[3]
    assert resale.is_resale and resale.max_price == 250 and cfg.shipping_estimate == 5
    assert cfg.resale_targets == {"max_age_minutes": 10, "min_discount": 40.0, "min_cheaper_than": 90.0,
                                  "min_profit": 15.0, "min_condition": "gut"}
    assert cfg.searches[1].min_score == 60 and cfg.searches[2].enabled is False
    assert cfg.account_enabled is False
