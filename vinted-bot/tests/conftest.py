import os
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vinted_bot.config import config_from_dict  # noqa: E402
from vinted_bot.models import parse_item  # noqa: E402

NOW = 1_800_000_000


def raw_item(item_id, price, title="Nike Air Max 90", status="Sehr gut", minutes_old=2, favs=0,
             brand="Nike", size="43", new_format=True):
    raw = {
        "id": item_id,
        "title": title,
        "brand_title": brand,
        "size_title": size,
        "status": status,
        "url": f"https://www.vinted.de/items/{item_id}-test",
        "favourite_count": favs,
        "user": {"id": 900 + item_id, "login": f"seller{item_id}"},
        "photo": {"url": f"https://images1.vinted.net/{item_id}.jpg",
                  "high_resolution": {"timestamp": NOW - minutes_old * 60}},
    }
    if new_format:
        raw["price"] = {"amount": f"{price:.1f}", "currency_code": "EUR"}
        raw["total_item_price"] = {"amount": f"{price + 1.5:.2f}", "currency_code": "EUR"}
    else:
        raw["price"] = f"{price:.1f}"
        raw["currency"] = "EUR"
        raw["total_item_price"] = f"{price + 1.5:.2f}"
    return raw


def item(item_id, price, **kw):
    return parse_item(raw_item(item_id, price, **kw), "https://www.vinted.de")


@pytest.fixture
def cfg(tmp_path):
    return config_from_dict({
        "vinted": {"domain": "vinted.de", "interval_seconds": 60, "max_item_age_minutes": 60},
        "searches": [{"name": "Air Max", "keywords": "nike air max 90", "max_price": 80}],
    }, base_dir=str(tmp_path))


class FakeClient:
    def __init__(self):
        self.pages = []
        self.queries = []

    def search(self, query, per_page=48):
        self.queries.append(query)
        return self.pages.pop(0) if self.pages else []


class FakeNotifier:
    def __init__(self):
        self.alerts = []
        self.texts = []

    def __bool__(self):
        return True

    def send_alert(self, alert):
        self.alerts.append(alert)
        return True

    def send_text(self, text, silent=False):
        self.texts.append(text)


@pytest.fixture
def clock():
    return lambda: NOW


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(time, "sleep", lambda *_: None)
