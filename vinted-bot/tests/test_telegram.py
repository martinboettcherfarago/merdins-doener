import pytest

from conftest import FakeClient, FakeNotifier, item
from vinted_bot.account import OfferResult
from vinted_bot.config import ConfigError
from vinted_bot.monitor import Monitor
from vinted_bot.notify import Alert, TelegramNotifier, money, telegram_caption, telegram_keyboard
from vinted_bot.scoring import score_item
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController, parse_new_search

CHAT = "4711"


def test_parse_new_search_keywords_and_options():
    s = parse_new_search("nike air max 90 bis 40 score 60")
    assert s.keywords == "nike air max 90"  # "max 90" ist KEIN Preis
    assert (s.max_price, s.min_score, s.min_price) == (40, 60, None)
    s = parse_new_search("Carhartt Jacke ab 20 bis 60€ markt 80")
    assert (s.keywords, s.min_price, s.max_price, s.market_price) == ("Carhartt Jacke", 20, 60, 80)


def test_parse_new_search_url():
    s = parse_new_search("https://www.vinted.de/catalog?search_text=levis%20501&brand_ids[]=10 bis 30")
    assert s.url.startswith("https://www.vinted.de/catalog?")
    assert s.name == "levis 501" and s.max_price == 30 and s.keywords is None
    with pytest.raises(ConfigError):
        parse_new_search("bis 30")


def test_money_format():
    assert money(1234.5) == "1.234,50 €"
    assert money(9, "GBP") == "9,00 £"


def make_alert(offers=(27.0, 24.0)):
    it = item(1, 30, title="Nike <Air> Max 90 & Co", favs=3)
    return Alert(item=it, search_name="Air Max", score=score_item(it, 50, now=it.created_ts + 60),
                 buy_url=it.buy_url("https://www.vinted.de"), offers=list(offers))


def test_caption_and_keyboard():
    alert = make_alert()
    cap = telegram_caption(alert, now=alert.item.created_ts + 120)
    assert "Nike &lt;Air&gt; Max 90 &amp; Co" in cap  # HTML sicher
    assert "30,00 €" in cap and "mit Käuferschutz 31,50 €" in cap
    assert "40% unter Marktpreis" in cap and "vor 2 Min." in cap and len(cap) <= 1024

    kb = telegram_keyboard(alert, offers_via_bot=True)["inline_keyboard"]
    assert kb[0][0]["url"].endswith("transaction%5Bitem_id%5D=1")
    assert [b["callback_data"] for b in kb[1]] == ["of:1:2700", "of:1:2400"]
    kb = telegram_keyboard(alert, offers_via_bot=False)["inline_keyboard"]
    assert kb[1][0]["url"] == alert.item.url


class FakeTelegram(TelegramNotifier):
    """Echter TelegramNotifier (gleiche Formatierung), aber ohne Netzwerk."""

    def __init__(self):
        super().__init__("TOKEN", CHAT)
        self.calls = []

    def api(self, method, **payload):
        self.calls.append((method, payload))
        return {"ok": True, "result": []}

    def texts(self):
        return [p["text"] for m, p in self.calls if m in ("sendMessage", "editMessageText")]


class FakeAccount:
    def __init__(self):
        self.offers = []

    def send_offer(self, item_id, seller_id, price, currency="EUR"):
        self.offers.append((item_id, seller_id, price, currency))
        return OfferResult(True, "Angebot gesendet ✅", "https://www.vinted.de/inbox/55")


@pytest.fixture
def bot(cfg, tmp_path, clock):
    storage = Storage(str(tmp_path / "t.db"))
    mon = Monitor(cfg, FakeClient(), storage, FakeNotifier(), clock=clock)
    tg = FakeTelegram()
    account = FakeAccount()
    return TelegramController(tg, mon, account), tg, storage, account


def msg(text, chat=CHAT):
    return {"update_id": 1, "message": {"chat": {"id": int(chat)}, "text": text}}


def test_commands_add_list_pause_delete(bot):
    ctl, tg, storage, _ = bot
    ctl.handle_update(msg("/neu carhartt jacke bis 60 score 50"))
    assert "Suche <b>carhartt jacke</b> angelegt" in tg.texts()[-1]
    ctl.handle_update(msg("/neu carhartt jacke"))  # gleicher Name -> wird durchnummeriert
    assert "carhartt jacke (2)" in tg.texts()[-1]

    ctl.handle_update(msg("/suchen"))
    listing = tg.texts()[-1]
    assert "1. ▶️ <b>Air Max</b>" in listing and "(config.yaml)" in listing
    assert "2. ▶️ <b>carhartt jacke</b> – 0–60 € · Score ≥ 50" in listing

    ctl.handle_update(msg("/pause 2"))
    assert storage.is_disabled("carhartt jacke")
    ctl.handle_update(msg("/weiter 2"))
    assert not storage.is_disabled("carhartt jacke")

    ctl.handle_update(msg("/loeschen 3"))
    assert [s.name for s in storage.custom_searches()] == ["carhartt jacke"]
    ctl.handle_update(msg("/loeschen 1"))  # config-Suche wird nur angehalten
    assert storage.is_disabled("Air Max")

    ctl.handle_update(msg("/pause"))
    assert ctl.monitor.paused
    ctl.handle_update(msg("/status"))
    assert "pausiert" in tg.texts()[-1]


def test_foreign_chats_are_ignored(bot):
    ctl, tg, storage, _ = bot
    ctl.handle_update(msg("/neu iphone", chat="999"))
    assert tg.calls == [] and storage.custom_searches() == []


def test_start_reveals_chat_id_during_setup(bot):
    ctl, tg, _, _ = bot
    ctl.chat_id = ""
    ctl.handle_update(msg("/start", chat="123"))
    method, payload = tg.calls[0]
    assert payload["chat_id"] == "123" and "<code>123</code>" in payload["text"]


def cb(data, chat=CHAT):
    return {"update_id": 2, "callback_query": {"id": "c1", "data": data,
                                               "message": {"chat": {"id": int(chat)}, "message_id": 10}}}


def test_offer_needs_confirmation_then_sends(bot):
    ctl, tg, storage, account = bot
    storage.save_item(item(1, 30))
    ctl.handle_update(cb("of:1:2400"))
    assert account.offers == []  # erst nachfragen
    confirm = [p for m, p in tg.calls if m == "sendMessage"][-1]
    assert "24,00 €" in confirm["text"]
    assert confirm["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == "ok:1:2400"

    ctl.handle_update(cb("ok:1:2400"))
    assert account.offers == [(1, 901, 24.0, "EUR")]
    assert "Angebot gesendet" in tg.texts()[-1]

    ctl.handle_update(cb("ok:1:2400", chat="999"))  # fremder Chat
    assert len(account.offers) == 1


def test_offer_daily_limit(bot):
    from datetime import date
    ctl, tg, storage, account = bot
    storage.save_item(item(1, 30))
    storage.set_state(f"offers:{date.today().isoformat()}", "25")
    ctl.handle_update(cb("ok:1:2400"))
    assert account.offers == []
    assert "höchstens 25" in tg.texts()[-1]


def test_extract_resale_options():
    from vinted_bot.telegram_bot import extract_options
    rest, opts = extract_options("nike air max 90 bis 80 rabatt 50% gewinn 20€ frisch 5 min")
    assert rest == "nike air max 90"
    assert opts == {"max_price": "80", "min_discount": "50", "min_profit": "20", "max_age_minutes": "5"}


def test_brand_watch_command(bot):
    ctl, tg, storage, _ = bot
    ctl.handle_update(msg("/marke stone island bis 300 rabatt 50"))
    s = storage.custom_searches()[0]
    assert s.name == "Marke · Stone Island" and s.is_resale and s.brands == ["Stone Island"]
    assert (s.max_price, s.min_discount, s.min_profit, s.max_age_minutes) == (300, 50, None, None)
    assert "Marktpreise dieser Marke" in tg.texts()[-1]

    ctl.handle_update(msg("/marke Stone Island"))
    assert "schon beobachtet" in tg.texts()[-1]
    ctl.handle_update(msg("/marke jacquemus"))
    assert storage.custom_searches()[-1].name == "Marke · Jacquemus"

    ctl.handle_update(msg("/suchen"))
    assert ("💰 Resale · 0–300 € · ≥ 50 % unter Markt · günstiger als 90 % · ≥ 15 € Gewinn · max. 10 Min. alt"
            in tg.texts()[-1])


def test_trends_command(bot):
    from vinted_bot.config import TREND_WATCHES as TREND_BRANDS
    ctl, tg, storage, _ = bot
    ctl.handle_update(msg("/trends"))
    assert "▫️ Carhartt" in tg.texts()[-1]
    ctl.handle_update(msg("/trends an"))
    assert len(storage.custom_searches()) == len(TREND_BRANDS)
    assert f"{len(TREND_BRANDS)} Trend-Marken" in tg.texts()[-1]
    ctl.handle_update(msg("/trends an"))  # kein doppeltes Anlegen
    assert len(storage.custom_searches()) == len(TREND_BRANDS)
    ctl.handle_update(msg("/trends"))
    assert "✅ Carhartt" in tg.texts()[-1]
    ctl.handle_update(msg("/trends aus"))
    assert storage.custom_searches() == []


def test_own_trend_brands(bot):
    from vinted_bot.config import TREND_WATCHES
    ctl, tg, storage, _ = bot
    mon = ctl.monitor
    ctl.handle_update(msg("/trends plus jacquemus, vintage lederjacke, Ganni Tasche"))
    assert "Jacquemus, Vintage Lederjacke, Ganni Tasche" in tg.texts()[-1]
    assert "günstiger als 90 %" in tg.texts()[-1]
    assert storage.get_list("trends_added") == ["Jacquemus", "Ganni Tasche"]  # Vintage Lederjacke ist eingebaut
    searches = {s.name: s for s in storage.custom_searches()}
    assert set(searches) == {"Marke · Jacquemus", "Trend · Vintage Lederjacke", "Trend · Ganni Tasche"}
    assert searches["Trend · Ganni Tasche"].brands == ["Ganni"]           # nur echte Ganni
    assert searches["Trend · Vintage Lederjacke"].brands == []            # jede Marke

    ctl.handle_update(msg("/trends +JACQUEMUS"))  # kein Duplikat
    assert mon.trend_brands().count("Jacquemus") == 1

    ctl.handle_update(msg("/trends minus miu miu, gibtsnicht"))
    assert "Miu Miu" not in mon.trend_brands()
    assert "Nicht in der Liste: gibtsnicht" in tg.texts()[-1]
    ctl.handle_update(msg("/trends -jacquemus"))
    assert "Jacquemus" not in mon.trend_brands()
    assert "Marke · Jacquemus" not in {s.name for s in storage.custom_searches()}

    ctl.handle_update(msg("/trends"))
    listing = tg.texts()[-1]
    assert f"Deine Trend-Liste ({len(TREND_WATCHES)})" in listing  # − Miu Miu + Ganni Tasche
    assert "<b>Marken</b>" in listing and "<b>Modelle &amp; Styles</b>" in listing
    assert "✅ Ganni Tasche ⭐" in listing and "▫️ Carhartt" in listing and "Miu Miu" not in listing

    ctl.handle_update(msg("/trends an"))
    assert len(storage.custom_searches()) == len(TREND_WATCHES)
    ctl.handle_update(msg("/trends plus miu miu"))  # eingebaute Marke zurückholen
    assert "Miu Miu" in mon.trend_brands() and storage.get_list("trends_added") == ["Ganni Tasche"]


def test_trends_minus_pauses_config_brand(cfg, tmp_path, clock):
    from conftest import FakeClient, FakeNotifier
    from vinted_bot.config import config_from_dict
    cfg2 = config_from_dict({"resale": {"brands": ["Nike", "Stüssy"]}}, base_dir=str(tmp_path))
    storage = Storage(str(tmp_path / "c.db"))
    mon = Monitor(cfg2, FakeClient(), storage, FakeNotifier(), clock=clock)
    ctl = TelegramController(FakeTelegram(), mon, None)
    ctl.handle_update(msg("/trends minus nike"))
    assert storage.is_disabled("Marke · Nike")  # steht in der config -> nur angehalten
    ctl.handle_update(msg("/trends plus nike"))
    assert not storage.is_disabled("Marke · Nike")


def test_level_command(bot):
    ctl, tg, storage, _ = bot
    ctl.handle_update(msg("/stufe"))
    assert "Stufe „auto“ – gerade „normal“" in tg.texts()[-1] and "/stufe streng" in tg.texts()[-1]
    ctl.handle_update(msg("/stufe streng"))
    text = tg.texts()[-1]
    assert "höchstens 5 Min." in text and "mind. 50 %" in text and "günstiger als 95 %" in text
    assert ctl.monitor.resale_targets()["min_cheaper_than"] == 95
    ctl.handle_update(msg("/status"))
    assert "Schnäppchen-Stufe: streng" in tg.texts()[-1]
    ctl.handle_update(msg("/stufe reset"))
    assert ctl.monitor.resale_level is None and ctl.monitor.auto_active()   # config-Standard: auto


def test_chatid_works_in_a_new_group_and_explains_the_config(bot):
    ctl, tg, _storage, _ = bot
    group = {"update_id": 5, "message": {"chat": {"id": -1001234567890, "type": "supergroup", "title": "Vinted Deals"},
                                         "text": "/chatid@MeinVintedBot"}}
    ctl.handle_update(group)
    method, payload = tg.calls[-1]
    assert method == "sendMessage" and payload["chat_id"] == "-1001234567890"
    assert "Vinted Deals" in payload["text"] and 'chat_id: "-1001234567890"' in payload["text"]
    assert "Minus" in payload["text"]
    ctl.handle_update(msg("/chatid"))                       # im eingetragenen Chat
    assert "schon eingetragen" in tg.texts()[-1]
    ctl.handle_update({"update_id": 6, "message": {"chat": {"id": -1001234567890, "type": "supergroup"},
                                                   "text": "/stufe streng"}})
    assert ctl.monitor.resale_level is None                 # fremde Gruppen dürfen weiterhin nichts steuern


def test_chat_not_found_is_explained_once(caplog):
    from vinted_bot import notify
    notify._explained.clear()

    class Broken:
        def send_text(self, text, silent=False):
            raise RuntimeError("Telegram sendMessage: Bad Request: chat not found")
    n = notify.MultiNotifier([Broken()])
    with caplog.at_level("ERROR"):
        n.send_text("hallo")
        n.send_text("nochmal")
    hints = [r.message for r in caplog.records if "chat_id aus der config.yaml" in r.message]
    assert len(hints) == 1 and "/chatid" in hints[0]
