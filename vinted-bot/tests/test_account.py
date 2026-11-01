import pytest

from vinted_bot.account import VintedAccount, extract_conversation_ids


class Resp:
    def __init__(self, status, data=None):
        self.status_code = status
        self._data = data or {}

    def json(self):
        return self._data


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []
        self.headers = {}

    def request(self, method, url, json=None, timeout=None):
        self.calls.append((method, url, json))
        return self.responses.pop(0)


COOKIES = "access_token_web=abc; refresh_token_web=def; anon_id=xyz"


def account(responses):
    s = FakeSession(responses)
    return VintedAccount("de", COOKIES, session=s), s


def test_send_offer_happy_path():
    acc, s = account([Resp(200, {"conversation_id": 55, "transaction_id": 77}), Resp(200, {"offer_request": {}})])
    res = acc.send_offer(1, 901, 24.0, "EUR")
    assert res.ok and res.conversation_url == "https://www.vinted.de/inbox/55"
    assert s.calls[0][1] == "https://api.vinted.de/messaging/main/inquiries"
    assert s.calls[0][2] == {"item_ids": ["1"], "receiver_id": "901"}
    assert s.calls[1][1] == "https://www.vinted.de/api/v2/transactions/77/offer_requests"
    assert s.calls[1][2] == {"offer_request": {"price": "24", "currency": "EUR"}}
    assert s.headers["X-Anon-Id"] == "xyz" and "X-CSRF-Token" in s.headers


def test_send_offer_falls_back_to_old_conversation_api():
    acc, s = account([Resp(404), Resp(200, {"conversation": {"id": 9, "transaction": {"id": 8}}}), Resp(201)])
    res = acc.send_offer(1, 901, 19.5)
    assert res.ok
    assert s.calls[1][2]["initiator"] == "buyer_enters_offer_form"
    assert s.calls[2][2] == {"offer_request": {"price": "19.5", "currency": "EUR"}}


def test_refreshes_token_once_on_401():
    acc, s = account([Resp(401), Resp(200), Resp(200, {"conversation_id": 1, "transaction_id": 2}), Resp(200)])
    assert acc.send_offer(1, 901, 10).ok
    assert s.calls[1][1].endswith("/web/api/auth/refresh")


def test_rejected_offer_is_reported():
    acc, _ = account([Resp(200, {"conversation_id": 1, "transaction_id": 2}),
                      Resp(400, {"message": "Preis zu niedrig"})])
    res = acc.send_offer(1, 901, 1)
    assert not res.ok and "Preis zu niedrig" in res.message and res.conversation_url


def test_missing_login_cookies():
    with pytest.raises(ValueError):
        VintedAccount("de", "anon_id=1", session=FakeSession([]))
    acc, _ = account([])
    assert not acc.send_offer(1, None, 10).ok


def test_extract_ids():
    assert extract_conversation_ids({"data": {"id": "c", "transaction_id": "5"}}) == ("c", 5)
    assert extract_conversation_ids({}) == (None, None)
