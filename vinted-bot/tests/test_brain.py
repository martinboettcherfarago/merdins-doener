"""Eigenes Bildmodell: Sammeln, Training (lernt es wirklich?), Bewerten, Einbindung in die Suche.

Statt CLIP (braucht PyTorch + 600-MB-Download) nutzen die Tests einen nachgebauten "Embedder":
Das Testbild enthält den wahren Wert des Artikels versteckt in seinem Fingerabdruck – genau wie bei
echten Fotos, in denen man Qualität, Stil und Marke "sieht". Die Faustregel kennt diesen Wert nicht.
So lässt sich prüfen, ob das Training das Muster lernt und die Faustregel schlägt.
"""

import math
import threading

import numpy as np
import pytest

from conftest import NOW, FakeNotifier, item
from test_telegram import FakeTelegram, msg
from vinted_bot.brain import (N_FEATURES, Brain, Dataset, auc, features, fit_logistic, fit_ridge, load_models,
                              save_models)
from vinted_bot.config import SearchConfig, config_from_dict
from vinted_bot.knowledge import estimate_item
from vinted_bot.monitor import Monitor
from vinted_bot.notify import telegram_caption
from vinted_bot.scoring import product_type
from vinted_bot.storage import Storage
from vinted_bot.telegram_bot import TelegramController

RNG = np.random.default_rng(42)
DIRECTION = RNG.normal(size=512)
DIRECTION /= np.linalg.norm(DIRECTION)
STYLE_DIR = RNG.normal(size=512)
STYLE_DIR -= STYLE_DIR @ DIRECTION * DIRECTION
STYLE_DIR /= np.linalg.norm(STYLE_DIR)


class FakeEmbedder:
    """Bild = b"IMG:<wahrer Wert>:<stil>:<id>" -> Fingerabdruck, der Wert und Stil enthält."""

    def __init__(self):
        self.error = ""
        self.calls = 0
        self.lock = threading.Lock()

    @staticmethod
    def installed():
        return True

    def images(self, blobs):
        out = []
        for b in blobs:
            _, value, style, seed = b.decode().split(":")
            rng = np.random.default_rng(int(seed))
            v = rng.normal(size=512) * 0.04
            v += DIRECTION * (math.log(float(value)) - 3.0) * 0.5 + STYLE_DIR * float(style) * 0.5
            out.append(v / np.linalg.norm(v))
        with self.lock:
            self.calls += 1
        return out

    def texts(self, texts):
        return [np.zeros(512) + 1 / math.sqrt(512) for _ in texts]

    def style(self, img):
        return ("90er-Sportswear", 0.6, 0.9)


def make_brain(tmp_path, **ml):
    cfg = config_from_dict({"ml": {"enabled": True, **ml}}, base_dir=str(tmp_path))
    store = {}
    brain = Brain(cfg, lambda url: store.get(url), embedder=FakeEmbedder())
    return brain, store


def listing(i, true_value, price, style=0.0, favs=0, created=None, title="Adidas Trainingsjacke"):
    it = item(i, price, title=title, brand="Adidas", size="M", favs=favs)
    it.photo_url = f"https://img/{i}.jpg"
    it.created_ts = created if created is not None else NOW - 600
    return it, f"IMG:{true_value}:{style}:{i}".encode()


def fill(brain, store, n=1500, seed=1):
    rng = np.random.default_rng(seed)
    for i in range(1, n + 1):
        true_value = float(np.exp(rng.normal(3.3, 0.6)))          # ~27 €, breit gestreut
        price = round(true_value * float(np.exp(rng.normal(0, 0.2))), 2)
        it, blob = listing(i, true_value, price, style=float(rng.normal()))
        store[it.photo_url] = blob
        ptype = product_type(it.title)
        est = estimate_item(it, ptype)
        brain._embed_item(it, ptype, est)


# -- Bausteine ----------------------------------------------------------------------------------

def test_ridge_and_logistic_learn_simple_patterns():
    rng = np.random.default_rng(0)
    X = np.c_[rng.normal(size=(400, 5)), np.ones(400)]
    w_true = np.array([1.0, -2.0, 0.5, 0.0, 3.0, 0.7])
    w = fit_ridge(X, X @ w_true + rng.normal(0, 0.01, 400), lam=0.01)
    assert np.allclose(w, w_true, atol=0.05)
    y = (X @ w_true > 0.7).astype(float)
    assert auc(X @ fit_logistic(X, y, lam=0.1), y) > 0.97
    assert auc(np.array([0.1, 0.9]), np.array([0, 1])) == 1.0


def test_features_layout():
    v = features(np.ones(512), np.ones(512), "luxus", "tasche", 1.35, True)
    assert v.shape == (N_FEATURES,) and v[-1] == 1 and v[-2] == 1 and v[-3] == pytest.approx(1.35)


def test_dataset_and_labels(tmp_path):
    brain, store = make_brain(tmp_path)
    it, blob = listing(7, 40, 20)
    store[it.photo_url] = blob
    ptype = product_type(it.title)
    brain._embed_item(it, ptype, estimate_item(it, ptype))
    assert brain.data.count() == 1 and brain.data.has(7)
    brain._embed_item(it, ptype, estimate_item(it, ptype))
    assert brain.embedder.calls == 1  # nicht doppelt berechnen
    brain.label_like(7, True)
    assert brain.label_fake(7, True) and not brain.label_fake(999, True)
    brain.data.seen_again(7, 9)
    assert brain.data.rows()[0][9] == 9


# -- Lernt das Modell wirklich? -----------------------------------------------------------------

def test_training_learns_value_from_photos_and_beats_the_rule_of_thumb(tmp_path):
    brain, store = make_brain(tmp_path)
    fill(brain, store, n=1500)
    rep = brain.train()
    assert rep.samples == 1500
    assert rep.value_mape < 0.25                      # sagt Preise neuer Artikel auf ~20 % genau voraus
    assert rep.heur_mape > rep.value_mape             # besser als die Faustregel
    assert brain.models["value_trusted"]
    assert "wird genutzt ✅" in rep.text()
    # Modell speichern & laden
    again = load_models(brain.model_path)
    assert np.allclose(again["value_w"], brain.models["value_w"])
    # Ein neuer Artikel, der "nach 120 €" aussieht, aber 30 € kostet:
    it, blob = listing(99_999, 120, 30)
    store[it.photo_url] = blob
    ptype = product_type(it.title)
    view = brain.assess(it, ptype, estimate_item(it, ptype))
    assert 80 < view.value < 180 and view.value_trusted
    assert "🧠 Eigenes Modell: Stil: 90er-Sportswear · Wert ca." in view.lines()[0]


def test_taste_model_learns_from_likes(tmp_path):
    brain, store = make_brain(tmp_path)
    fill(brain, store, n=400)
    rows = brain.data.rows()
    for r in rows[:120]:  # der Nutzer mag einen bestimmten Stil (in den Fotos versteckt)
        img = np.frombuffer(r[11], dtype=np.float16).astype(float)
        brain.label_like(r[0], bool(img @ STYLE_DIR > 0))
    rep = brain.train()
    assert rep.taste_n == 120 and rep.taste_auc > 0.85
    it, blob = listing(50_000, 30, 30, style=2.5)
    store[it.photo_url] = blob
    ptype = product_type(it.title)
    assert brain.assess(it, ptype, estimate_item(it, ptype)).taste > 0.7


def test_fake_model_learns_from_teacher_labels(tmp_path):
    brain, store = make_brain(tmp_path)
    fill(brain, store, n=300)
    for r in brain.data.rows()[:200]:
        img = np.frombuffer(r[11], dtype=np.float16).astype(float)
        brain.label_fake(r[0], bool(img @ STYLE_DIR > 0.3))  # "Fakes" sehen anders aus
    rep = brain.train()
    assert rep.fake_n == 200 and rep.fake_auc > 0.85
    assert "fake_w" in brain.models


def test_too_little_data(tmp_path):
    brain, store = make_brain(tmp_path)
    fill(brain, store, n=50)
    rep = brain.train()
    assert "Noch zu wenig Daten" in rep.text() and not brain.models


# -- Einbindung in die Suche ----------------------------------------------------------------------

@pytest.fixture
def trained(tmp_path):
    brain, store = make_brain(tmp_path)
    fill(brain, store, n=1500)
    brain.train()
    cfg = config_from_dict({"resale": {"brands": ["Vintage Adidas"]}}, base_dir=str(tmp_path))
    from conftest import FakeClient
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "m.db")), FakeNotifier(), clock=lambda: NOW)
    m.brain = brain
    return m, brain, store


def test_model_finds_deal_the_rule_of_thumb_misses(trained):
    m, brain, store = trained
    s = m.effective(SearchConfig.watch("Vintage Adidas"))
    # Faustregel: Adidas-Jacke ≈ 35 €, 22 € sind nur 37 % darunter -> kein Schnäppchen.
    # Das Foto zeigt aber ein Teil, das ~110 € wert ist (z. B. seltenes Modell) -> das Modell erkennt es.
    it, blob = listing(70_001, 110, 22, title="Adidas Jacke")
    it.created_ts = NOW - 60
    store[it.photo_url] = blob
    m.brain = None
    assert m.explain(s, it, NOW)[0] is None                      # ohne eigenes Modell: verpasst
    m.brain = brain
    alert, why = m.explain(s, it, NOW)
    assert alert is not None, why                                # mit eigenem Modell: gefunden
    assert "+ eigenes Modell" in " ".join(alert.score.reasons)
    assert "🧠 Eigenes Modell:" in telegram_caption(alert, now=NOW)


def test_model_fake_risk_blocks_alert(trained):
    m, brain, store = trained
    brain.models["fake_w"] = np.zeros(N_FEATURES)
    brain.models["fake_w"][-1] = 5.0  # Testmodell: "alles sieht nach Fake aus"
    brain.models["fake_auc"] = 0.9
    s = m.effective(SearchConfig.watch("Vintage Adidas"))
    it, blob = listing(70_002, 110, 22, title="Adidas Jacke")
    it.created_ts = NOW - 60
    store[it.photo_url] = blob
    assert m.explain(s, it, NOW) == (None, "eigenes Modell: Fake-Risiko 99%")


def test_search_collects_training_data(tmp_path):
    brain, store = make_brain(tmp_path)
    cfg = config_from_dict({"resale": {"brands": ["Vintage Adidas"]}}, base_dir=str(tmp_path))
    from conftest import FakeClient
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "c.db")), FakeNotifier(), clock=lambda: NOW)
    m.brain = brain
    batch = []
    for i in range(1, 6):
        it, blob = listing(i, 30, 25, title="Vintage Adidas Pullover")
        store[it.photo_url] = blob
        batch.append(it)
    m.client.pages = [batch]
    m.run_once()
    assert brain._queue.qsize() == 5     # landet in der Sammel-Warteschlange
    while brain._queue.qsize():
        it, ptype, est = brain._queue.get()
        brain._embed_item(it, ptype, est)
    assert brain.data.count() == 5


class PagedClient:
    def __init__(self, store):
        self.store, self.calls = store, []

    def search(self, query, per_page=48, page=1):
        self.calls.append(page)
        out = []
        for k in range(96 if page < 3 else 10):
            i = page * 1000 + k
            it, blob = listing(i, 40, 30, title="Vintage Adidas Pullover")
            self.store[it.photo_url] = blob
            out.append(it)
        return out


def test_sammel_turbo_collects_thousands_and_trains(tmp_path):
    brain, store = make_brain(tmp_path)
    cfg = config_from_dict({"resale": {"brands": ["Vintage Adidas", "Adidas 90er"]}}, base_dir=str(tmp_path))
    from conftest import FakeClient
    m = Monitor(cfg, FakeClient(), Storage(str(tmp_path / "t.db")), FakeNotifier(), clock=lambda: NOW)
    m.brain = brain
    brain.start()
    messages = []
    m.bootstrap(pages=5, client=PagedClient(store), done=messages.append)
    brain.stop()
    assert brain.data.count() == 96 + 96 + 10                  # Seiten 1–3, dann keine weitere Seite
    assert "Sammel-Turbo fertig" in messages[0] and "Eigenes Modell trainiert" in messages[0]


def test_model_commands(trained):
    m, brain, _ = trained
    tg = FakeTelegram()
    ctl = TelegramController(tg, m, None)
    ctl.handle_update(msg("/modell"))
    text = tg.texts()[-1]
    assert "Datensatz: <b>1.500 Bilder</b>" in text and "wird genutzt ✅" in text
    ctl.handle_update(msg("/fake https://www.vinted.de/items/12-x"))
    assert "Gemerkt: Fake" in tg.texts()[-1]
    ctl.handle_update(msg("/echt https://www.vinted.de/items/99999999-x"))
    assert "noch nicht gesehen" in tg.texts()[-1]
    m.brain = None
    ctl.handle_update(msg("/modell"))
    assert "ki-installieren.bat" in tg.texts()[-1]


def test_save_load_roundtrip(tmp_path):
    path = str(tmp_path / "m.npz")
    save_models({"value_w": np.arange(3.0), "value_mape": 0.2, "value_trusted": True}, path)
    m = load_models(path)
    assert m["value_trusted"] and m["value_mape"] == 0.2 and list(m["value_w"]) == [0, 1, 2]
    assert Dataset(str(tmp_path / "d.db")).count() == 0


# -- Das echte Bild-Grundmodell (nur wenn PyTorch + open_clip installiert sind) ------------------

def test_real_clip_embedder_runs_on_cpu():
    from vinted_bot.brain import Embedder
    if not Embedder.installed():
        pytest.skip("PyTorch/open_clip nicht installiert (ki-installieren.bat)")
    import io
    import time
    from PIL import Image
    emb = Embedder(threads=2, pretrained=None)  # Architektur ohne Download (zufällige Gewichte)
    buf = io.BytesIO()
    Image.new("RGB", (640, 800), (200, 30, 30)).save(buf, format="JPEG")
    t0 = time.time()
    vecs = emb.images([buf.getvalue()] * 8 + [b"kein bild"])
    per_image = (time.time() - t0) / 8
    assert vecs[-1] is None and all(v.shape == (512,) for v in vecs[:8])
    assert abs(float(np.linalg.norm(vecs[0])) - 1) < 1e-4
    assert emb.texts(["Adidas Trainingsjacke 90er"]).shape == (1, 512)
    style, conf, quality = emb.style(vecs[0])
    assert style and 0 <= conf <= 1 and 0 <= quality <= 1
    assert per_image < 2.0  # auf einem normalen PC-Prozessor deutlich unter 1 s pro Foto
