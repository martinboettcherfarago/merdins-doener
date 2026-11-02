"""Eigenes KI-Modell des Bots – trainiert auf DEINEN Vinted-Daten, lokal auf deinem PC.

So funktioniert es:
1. Sammeln: Von den Artikeln, die der Bot auf Vinted sieht (Tausende pro Tag), lädt er ein Foto,
   berechnet daraus mit einem frei verfügbaren Bild-Text-Grundmodell (CLIP, ViT-B/32) einen
   "Bild-Fingerabdruck" (512 Zahlen) und speichert ihn mit Marke, Kategorie, Zustand, Preis und
   Favoriten in data/ki_daten.db. Die Fotos selbst werden nicht gespeichert.
2. Trainieren: Alle paar Stunden trainiert er darauf seine eigenen Modelle:
   - Wert-Modell:     Was kostet ein Teil, das SO aussieht, auf Vinted? (Regression)
   - Begehrt-Modell:  Was sammelt schnell viele Favoriten? (Klassifikation)
   - Geschmack:       Was gefällt dir? (aus deinen 👍/👎)
   - Fake-Modell:     lernt aus den Urteilen des Claude-Bildchecks und deinen /fake- bzw. /echt-Meldungen
3. Bewerten: Jeder Kandidat wird von den eigenen Modellen bewertet – kostenlos, lokal, in ~0,2 s.

Das Grundmodell (CLIP) wird einmalig heruntergeladen (~600 MB), PyTorch braucht ~200 MB.
Ehrlich: Wie gut die Modelle werden, hängt von der Menge und Qualität der Daten ab. Das Wert-
und Begehrt-Modell lernen aus Tausenden Artikeln schnell etwas Brauchbares; ein Fake-Modell braucht
viele bestätigte Fakes und ist am Anfang inaktiv. Der Bot zeigt bei /modell, wie gut die Modelle
auf neuen, ungesehenen Daten abschneiden – und nutzt das Wert-Modell nur, wenn es die Faustregel schlägt.
"""

from __future__ import annotations

import io
import json
import logging
import math
import os
import queue
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

import numpy as np

from .catalog import FAMILY_LABELS, family_of
from .tags import COOL_THRESHOLD, SHOWN_GROUPS, TAG_GROUPS, THRESHOLDS, cool_score, count_tags

log = logging.getLogger(__name__)

# Bild-Grundmodelle (über open_clip, Download einmalig auf deinem PC):
#   fashion: Marqo-FashionSigLIP – speziell auf Mode-Produktfotos trainiert (Apache-2.0), ~110 ms/Foto auf 4 Kernen
#   schnell: CLIP ViT-B/32 (LAION-2B) – allgemein, ~40 ms/Foto
BACKBONES: dict[str, tuple[str, Optional[str], str]] = {
    "fashion": ("hf-hub:Marqo/marqo-fashionSigLIP", None, "Marqo-FashionSigLIP (Mode-Spezialist)"),
    "schnell": ("ViT-B-32", "laion2b_s34b_b79k", "CLIP ViT-B/32 (schnell)"),
}
BACKBONE = BACKBONES["schnell"][:2]   # alter Name
EMB = 512                              # Standard-Größe (ViT-B/32); FashionSigLIP liefert 768
TIER_KEYS = ["", "budget", "standard", "premium", "streetwear", "outdoor", "designer", "luxus"]
FAMILY_KEYS = list(FAMILY_LABELS)


def n_features(dim: int = EMB) -> int:
    return 2 * dim + len(TIER_KEYS) + len(FAMILY_KEYS) + 3


N_FEATURES = n_features()

# Kurz-Stil für alte Aufrufe (style): aus den Tags abgeleitet
STYLES = {label: prompt for label, prompt, _ in TAG_GROUPS["stil"]}


@dataclass
class Tag:
    group: str
    label: str
    prob: float
    ptype: Optional[str] = None


# -- Bild-Fingerabdrücke & Tags (open_clip) -------------------------------------------------------

class Embedder:
    """Berechnet Bild- und Text-Fingerabdrücke und erkennt Tags. Lädt PyTorch erst beim ersten Gebrauch."""

    def __init__(self, threads: int = 2, backbone: str = "fashion", pretrained: Any = "default"):
        self.threads = threads
        self.backbone = backbone if backbone in BACKBONES else "fashion"
        arch, tag, self.label = BACKBONES[self.backbone]
        self.arch = arch
        self.pretrained = tag if pretrained == "default" else pretrained
        self._custom_weights = pretrained != "default"   # Tests: pretrained=None = ohne Download
        self._lock = threading.Lock()
        self._model: Any = None
        self._preprocess: Any = None
        self._tokenizer: Any = None
        self._scale = 100.0
        self._tag_vecs: dict[str, np.ndarray] = {}
        self.dim = 0
        self.error = ""
        self.fallback = ""     # gesetzt, wenn statt des Mode-Modells das schnelle Modell läuft

    @staticmethod
    def installed() -> bool:
        """Sind PyTorch und open_clip installiert? (ki-installieren.bat) – lädt sie noch nicht."""
        import importlib.util
        return all(importlib.util.find_spec(m) is not None for m in ("torch", "open_clip"))

    def _load(self) -> None:
        if self._model is not None:
            return
        import open_clip
        import torch
        torch.set_num_threads(max(1, self.threads))
        log.info("Lade Bildmodell %s (beim ersten Mal einmaliger Download) …", self.label)
        try:
            if self.arch.startswith("hf-hub:"):
                import importlib.util
                if importlib.util.find_spec("transformers") is None:
                    raise ImportError("Paket 'transformers' fehlt")
                model, _, preprocess = open_clip.create_model_and_transforms(self.arch)
            else:
                model, _, preprocess = open_clip.create_model_and_transforms(self.arch, pretrained=self.pretrained)
            tokenizer = open_clip.get_tokenizer(self.arch)
        except Exception as e:  # noqa: BLE001
            if self.backbone == "schnell":
                raise
            # z. B. Paket "transformers" fehlt oder Hugging Face nicht erreichbar -> schnelles Modell nehmen
            log.warning("Mode-Bildmodell nicht ladbar (%s) – nehme das schnelle CLIP-Modell. "
                        "Tipp: ki-installieren.bat erneut ausführen.", e)
            self.fallback = f"{self.label} nicht ladbar ({type(e).__name__}) – nutze CLIP ViT-B/32"
            self.backbone = "schnell"
            self.arch, tag, self.label = BACKBONES["schnell"]
            self.pretrained = self.pretrained if self._custom_weights else tag
            model, _, preprocess = open_clip.create_model_and_transforms(self.arch, pretrained=self.pretrained)
            tokenizer = open_clip.get_tokenizer(self.arch)
        model.eval()
        self._model, self._preprocess = model, preprocess
        self._tokenizer = tokenizer
        try:
            self._scale = float(model.logit_scale.detach().exp())
        except Exception:  # noqa: BLE001
            self._scale = 100.0
        for group, defs in TAG_GROUPS.items():
            self._tag_vecs[group] = self._texts_unlocked([prompt for _, prompt, _ in defs])
        self.dim = int(self._tag_vecs["kategorie"].shape[1])

    def _texts_unlocked(self, texts: list[str]) -> np.ndarray:
        import torch
        with torch.no_grad():
            f = self._model.encode_text(self._tokenizer(texts))
            f = f / f.norm(dim=-1, keepdim=True)
        return f.float().numpy()

    def texts(self, texts: list[str]) -> np.ndarray:
        with self._lock:
            self._load()
            return self._texts_unlocked(texts)

    def images(self, blobs: list[bytes]) -> list[Optional[np.ndarray]]:
        """Fotos -> Fingerabdrücke (None für Bilder, die sich nicht lesen lassen)."""
        import torch
        from PIL import Image
        with self._lock:
            self._load()
            tensors, idx = [], []
            for i, blob in enumerate(blobs):
                try:
                    img = Image.open(io.BytesIO(blob)).convert("RGB")
                    tensors.append(self._preprocess(img))
                    idx.append(i)
                except Exception:  # noqa: BLE001
                    continue
            out: list[Optional[np.ndarray]] = [None] * len(blobs)
            if tensors:
                with torch.no_grad():
                    f = self._model.encode_image(torch.stack(tensors))
                    f = f / f.norm(dim=-1, keepdim=True)
                for j, vec in zip(idx, f.float().numpy()):
                    out[j] = vec
            return out

    def tags(self, img: np.ndarray) -> list[Tag]:
        """Alle Tag-Gruppen für ein Foto: je Gruppe die wahrscheinlichsten Tags über der Schwelle."""
        with self._lock:
            self._load()
            vecs, scale = self._tag_vecs, self._scale
        out: list[Tag] = []
        for group, defs in TAG_GROUPS.items():
            sims = vecs[group] @ img * scale
            p = np.exp(sims - sims.max())
            p /= p.sum()
            order = np.argsort(-p)
            limit = 2 if group in ("farbe", "details", "stil") else 1
            for k in order[:limit]:
                if p[k] >= THRESHOLDS[group]:
                    label, _, ptype = defs[k]
                    out.append(Tag(group, label, float(p[k]), ptype))
        return out

    def style(self, img: np.ndarray) -> tuple[str, float, float]:
        """(Stil, Sicherheit 0–1, Fotoqualität 0–1) – Kurzfassung der Tags."""
        tags = self.tags(img)
        st = next((t for t in tags if t.group == "stil"), None)
        blurry = next((t.prob for t in tags if t.group == "foto" and t.label == "unscharf/dunkel"), 0.0)
        return (st.label if st else ""), (st.prob if st else 0.0), 1.0 - blurry


# -- Datensatz ----------------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS samples (
    item_id INTEGER PRIMARY KEY, ts REAL NOT NULL, title TEXT, brand TEXT, tier TEXT, family TEXT,
    cond REAL, kids INTEGER, price REAL NOT NULL, heur REAL, created REAL, favs INTEGER,
    last_favs INTEGER, last_seen REAL, img BLOB NOT NULL, txt BLOB NOT NULL,
    liked INTEGER, fake INTEGER, ai_value REAL, ai_look INTEGER
);
CREATE INDEX IF NOT EXISTS samples_ts ON samples (ts);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
"""


def _blob(vec: np.ndarray) -> bytes:
    return np.asarray(vec, dtype=np.float16).tobytes()


def _vec(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float16).astype(np.float32)


@dataclass
class Sample:
    item_id: int
    title: str
    brand: str
    tier: str
    family: str
    cond: float
    kids: bool
    price: float
    heur: float
    created: Optional[float]
    favs: int
    img: np.ndarray
    txt: np.ndarray


class Dataset:
    def __init__(self, path: str):
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.executescript(SCHEMA)
        self._db.commit()

    def has(self, item_id: int) -> bool:
        with self._lock:
            return self._db.execute("SELECT 1 FROM samples WHERE item_id=?", (item_id,)).fetchone() is not None

    def add(self, s: Sample) -> None:
        with self._lock:
            self._db.execute(
                "INSERT OR IGNORE INTO samples (item_id, ts, title, brand, tier, family, cond, kids, price, heur, "
                "created, favs, last_favs, last_seen, img, txt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (s.item_id, time.time(), s.title, s.brand, s.tier, s.family, s.cond, int(s.kids), s.price, s.heur,
                 s.created, s.favs, s.favs, time.time(), _blob(s.img), _blob(s.txt)))
            self._db.commit()

    def ids(self) -> set[int]:
        with self._lock:
            return {r[0] for r in self._db.execute("SELECT item_id FROM samples")}

    def get_vectors(self, item_id: int) -> Optional[tuple[np.ndarray, np.ndarray]]:
        with self._lock:
            row = self._db.execute("SELECT img, txt FROM samples WHERE item_id=?", (item_id,)).fetchone()
        return (_vec(row[0]), _vec(row[1])) if row else None

    def seen_again(self, item_id: int, favs: int) -> None:
        with self._lock:
            self._db.execute("UPDATE samples SET last_favs=MAX(COALESCE(last_favs,0), ?), last_seen=? "
                             "WHERE item_id=?", (favs, time.time(), item_id))
            self._db.commit()

    def label(self, item_id: int, **values: Any) -> bool:
        cols = {k: v for k, v in values.items() if k in ("liked", "fake", "ai_value", "ai_look")}
        if not cols:
            return False
        with self._lock:
            cur = self._db.execute(f"UPDATE samples SET {', '.join(f'{k}=?' for k in cols)} WHERE item_id=?",
                                   (*cols.values(), item_id))
            self._db.commit()
            return cur.rowcount > 0

    def count(self, where: str = "1=1") -> int:
        with self._lock:
            return int(self._db.execute(f"SELECT COUNT(*) FROM samples WHERE {where}").fetchone()[0])

    def rows(self, where: str = "1=1", limit: int = 120_000) -> list[tuple]:
        with self._lock:
            return self._db.execute(
                "SELECT item_id, tier, family, cond, kids, price, heur, created, favs, last_favs, last_seen, "
                f"img, txt, liked, fake FROM samples WHERE {where} ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()

    def get_meta(self, key: str, default: str = "") -> str:
        with self._lock:
            row = self._db.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row[0] if row else default

    def set_meta(self, key: str, value: str) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, value))
            self._db.commit()


def features(img: np.ndarray, txt: np.ndarray, tier: str, family: str, cond: float, kids: bool) -> np.ndarray:
    dim = len(img)
    v = np.zeros(n_features(dim), dtype=np.float32)
    v[:dim] = img
    v[dim:2 * dim] = txt
    o = 2 * dim
    v[o + (TIER_KEYS.index(tier) if tier in TIER_KEYS else 0)] = 1
    o += len(TIER_KEYS)
    if family in FAMILY_KEYS:
        v[o + FAMILY_KEYS.index(family)] = 1
    v[-3] = cond
    v[-2] = 1.0 if kids else 0.0
    v[-1] = 1.0
    return v


# -- Training (reines numpy, keine Grafikkarte nötig) ------------------------------------------

def fit_ridge(X: np.ndarray, y: np.ndarray, lam: float) -> np.ndarray:
    A = X.T @ X
    A[np.diag_indices_from(A)] += lam
    A[-1, -1] -= lam  # Achsenabschnitt nicht bestrafen
    return np.linalg.solve(A, X.T @ y)


def fit_logistic(X: np.ndarray, y: np.ndarray, lam: float = 1.0, iters: int = 12) -> np.ndarray:
    """L2-regularisierte logistische Regression (Newton-Verfahren)."""
    w = np.zeros(X.shape[1], dtype=np.float64)
    reg = np.full(X.shape[1], lam)
    reg[-1] = 0.0
    for _ in range(iters):
        p = 1 / (1 + np.exp(-np.clip(X @ w, -30, 30)))
        g = X.T @ (p - y) + reg * w
        H = (X * (p * (1 - p))[:, None]).T @ X
        H[np.diag_indices_from(H)] += reg + 1e-6
        step = np.linalg.solve(H, g)
        w -= step
        if np.abs(step).max() < 1e-5:
            break
    return w


def auc(scores: np.ndarray, labels: np.ndarray) -> float:
    pos, neg = scores[labels == 1], scores[labels == 0]
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    order = np.argsort(np.concatenate([pos, neg]))
    ranks = np.empty(len(order))
    ranks[order] = np.arange(1, len(order) + 1)
    return float((ranks[:len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def median_ape(pred: np.ndarray, truth: np.ndarray) -> float:
    return float(np.median(np.abs(pred - truth) / truth))


@dataclass
class TrainReport:
    samples: int = 0
    value_mape: Optional[float] = None
    heur_mape: Optional[float] = None
    pop_auc: Optional[float] = None
    taste_n: int = 0
    taste_auc: Optional[float] = None
    fake_n: int = 0
    fake_auc: Optional[float] = None
    seconds: float = 0.0
    notes: list[str] = field(default_factory=list)

    def text(self) -> str:
        lines = [f"🧠 <b>Eigenes Modell trainiert</b> – {self.samples:,} Bilder in {self.seconds:.0f} s".replace(",", ".")]
        if self.value_mape is not None:
            better = self.heur_mape is not None and self.value_mape < self.heur_mape
            lines.append(f"💶 Wert-Modell: Ø {self.value_mape:.0%} Abweichung bei neuen Artikeln"
                         + (f" (Faustregel: {self.heur_mape:.0%}) – {'wird genutzt ✅' if better else 'noch schlechter als die Faustregel, wird noch nicht genutzt'}"
                            if self.heur_mape is not None else ""))
        if self.pop_auc is not None and not math.isnan(self.pop_auc):
            lines.append(f"🔥 Begehrt-Modell: Trefferqualität {self.pop_auc:.0%} (50 % = Zufall)")
        lines.append(f"❤️ Geschmack: {self.taste_n} Bewertungen" + (
            f", Trefferqualität {self.taste_auc:.0%}" if self.taste_auc is not None and not math.isnan(self.taste_auc)
            else " (ab 10 👍/👎 aktiv)"))
        lines.append(f"🔍 Fake-Modell: {self.fake_n} bestätigte Beispiele" + (
            f", Trefferqualität {self.fake_auc:.0%}" if self.fake_auc is not None and not math.isnan(self.fake_auc)
            else " (ab 15 Fakes und 15 echten aktiv)"))
        lines += self.notes
        return "\n".join(lines)


def train_models(data: Dataset, seed: int = 0) -> tuple[dict[str, Any], TrainReport]:
    """Trainiert alle Teilmodelle. Bewertet jedes auf 20 % zurückgehaltenen Daten (ehrliche Zahlen)."""
    t0 = time.time()
    rng = np.random.default_rng(seed)
    rows = data.rows()
    if rows:  # nur Fingerabdrücke eines Bildmodells mischen (z. B. nach einem Wechsel schnell <-> fashion)
        sizes = [len(r[11]) for r in rows]
        main = max(set(sizes), key=sizes.count)
        rows = [r for r in rows if len(r[11]) == main]
    rep = TrainReport(samples=len(rows))
    models: dict[str, Any] = {"version": 1, "trained_at": time.time(), "samples": len(rows)}
    if len(rows) < 200:
        rep.notes.append("Noch zu wenig Daten (ab 200 Artikeln wird trainiert).")
        rep.seconds = time.time() - t0
        return models, rep
    X = np.stack([features(_vec(r[11]), _vec(r[12]), r[1] or "", r[2] or "", r[3] or 1.0, bool(r[4])) for r in rows])
    price = np.array([max(1.0, r[5]) for r in rows])
    heur = np.array([r[6] or np.nan for r in rows])
    perm = rng.permutation(len(rows))
    split = int(len(rows) * 0.8)
    tr, va = perm[:split], perm[split:]

    # 1) Wert-Modell: log(Preis) aus Bild + Titel + Marke + Kategorie + Zustand
    y = np.log(price)
    best = None
    for lam in (1.0, 10.0, 100.0):
        w = fit_ridge(X[tr].astype(np.float64), y[tr], lam)
        mape = median_ape(np.exp(X[va] @ w), price[va])
        if best is None or mape < best[0]:
            best = (mape, lam, w)
    mape, lam, _ = best
    models["value_w"] = fit_ridge(X.astype(np.float64), y, lam)
    rep.value_mape = mape
    ok = ~np.isnan(heur[va])
    rep.heur_mape = median_ape(heur[va][ok], price[va][ok]) if ok.sum() >= 20 else None
    models["value_mape"], models["heur_mape"] = mape, rep.heur_mape
    models["value_trusted"] = bool(rep.heur_mape is not None and mape < rep.heur_mape and len(rows) >= 1000)

    # 2) Begehrt: viele Favoriten kurz nach dem Hochladen (nur Artikel, die wir ≥ 30 Min. beobachtet haben)
    created = np.array([r[7] or np.nan for r in rows])
    last_seen = np.array([r[10] or np.nan for r in rows])
    last_favs = np.array([r[9] or 0 for r in rows], dtype=float)
    hours = (last_seen - created) / 3600
    obs = ~np.isnan(hours) & (hours >= 0.5)
    if obs.sum() >= 200:
        rate = last_favs[obs] / np.maximum(hours[obs], 0.5)
        label = (rate >= max(1.0, np.quantile(rate, 0.8))).astype(float)
        Xo = X[obs].astype(np.float64)
        idx = rng.permutation(len(Xo))[:30_000]
        cut = int(len(idx) * 0.8)
        w = fit_logistic(Xo[idx[:cut]], label[idx[:cut]], lam=10.0)
        rep.pop_auc = auc(Xo[idx[cut:]] @ w, label[idx[cut:]])
        models["pop_w"], models["pop_auc"] = fit_logistic(Xo[idx], label[idx], lam=10.0), rep.pop_auc

    # 3) Geschmack (deine 👍/👎) und 4) Fake (Claude-Urteile + deine Meldungen)
    for key, col, minimum in (("taste", 13, 10), ("fake", 14, 30)):
        lab = np.array([np.nan if r[col] is None else float(r[col] > 0) for r in rows])
        has = ~np.isnan(lab)
        n = int(has.sum())
        setattr(rep, f"{key}_n", n)
        pos = int((lab[has] == 1).sum())
        if n >= minimum and min(pos, n - pos) >= minimum // 2:
            Xl, yl = X[has].astype(np.float64), lab[has]
            # 5-fache Kreuzvalidierung: wählt die Regularisierung und liefert eine ehrliche Trefferqualität
            folds = np.array_split(rng.permutation(n), 5)
            best = None
            for lam in (0.3, 3.0, 30.0):
                scores = np.empty(n)
                for f in folds:
                    mask = np.ones(n, bool)
                    mask[f] = False
                    scores[f] = Xl[f] @ fit_logistic(Xl[mask], yl[mask], lam=lam)
                p = np.clip(1 / (1 + np.exp(-np.clip(scores, -30, 30))), 1e-6, 1 - 1e-6)
                logloss = float(-np.mean(yl * np.log(p) + (1 - yl) * np.log(1 - p)))
                if best is None or logloss < best[0]:
                    best = (logloss, lam, auc(scores, yl))
            _, lam, cv_auc = best
            setattr(rep, f"{key}_auc", cv_auc)
            models[f"{key}_w"], models[f"{key}_auc"] = fit_logistic(Xl, yl, lam=lam), cv_auc
    rep.seconds = time.time() - t0
    return models, rep


def save_models(models: dict[str, Any], path: str) -> None:
    arrays = {k: v for k, v in models.items() if isinstance(v, np.ndarray)}
    meta = {k: v for k, v in models.items() if not isinstance(v, np.ndarray)}
    tmp = path + ".tmp.npz"
    np.savez_compressed(tmp, meta=np.array(json.dumps(meta)), **arrays)
    os.replace(tmp, path)


def load_models(path: str) -> dict[str, Any]:
    if not os.path.exists(path):
        return {}
    with np.load(path, allow_pickle=False) as z:
        models: dict[str, Any] = json.loads(str(z["meta"]))
        for k in z.files:
            if k != "meta":
                models[k] = z[k]
    return models


# -- Das Gehirn: Sammeln, Trainieren, Bewerten -------------------------------------------------

@dataclass
class BrainView:
    value: Optional[float] = None      # Wert laut eigenem Modell (€)
    value_trusted: bool = False
    popular: Optional[float] = None    # Wahrscheinlichkeit "begehrt"
    taste: Optional[float] = None      # Wahrscheinlichkeit "gefällt dir"
    fake: Optional[float] = None       # Fake-Risiko
    style: str = ""
    style_conf: float = 0.0
    photo_quality: float = 0.0
    tags: list[Tag] = field(default_factory=list)
    cool: float = 0.0                  # Cool-Faktor aus den Foto-Tags (90er, Sportswear, Fellkragen …)
    cool_bits: list[str] = field(default_factory=list)
    popular_trusted: bool = False      # Begehrt-Modell hat die Prüfung bestanden

    @property
    def is_cool(self) -> bool:
        return self.cool >= COOL_THRESHOLD

    def tag(self, group: str, min_prob: float = 0.0) -> Optional[Tag]:
        return next((t for t in self.tags if t.group == group and t.prob >= min_prob), None)

    def tag_labels(self) -> list[str]:
        out: list[str] = []
        for group in SHOWN_GROUPS:
            labels = [t.label for t in self.tags if t.group == group]
            if labels:
                out.append("/".join(labels) if group == "farbe" else " · ".join(labels))
        return out

    def lines(self) -> list[str]:
        out = []
        labels = self.tag_labels()
        if labels:
            out.append(f"🏷 Foto erkannt: {' · '.join(labels)}")
        bits = []
        if not labels and self.style and self.style_conf >= 0.25:
            bits.append(f"Stil: {self.style}")
        if self.value is not None:
            bits.append(f"Wert ca. {self.value:.0f} €" + ("" if self.value_trusted else " (lernt noch)"))
        if self.popular is not None:
            bits.append(f"begehrt {self.popular:.0%}")
        if self.taste is not None:
            bits.append(f"passt zu dir {self.taste:.0%}")
        if self.fake is not None and self.fake >= 0.4:
            bits.append(f"⚠️ Fake-Risiko {self.fake:.0%}")
        if bits:
            out.append(f"🧠 Eigenes Modell: {' · '.join(bits)}")
        return out


def _sigmoid(x: float) -> float:
    return 1 / (1 + math.exp(-max(-30.0, min(30.0, x))))


class Brain:
    def __init__(self, cfg: Any, fetch_bytes: Callable[[str], Optional[bytes]],
                 embedder: Optional[Embedder] = None, report: Optional[Callable[[str], None]] = None):
        self.cfg = cfg
        self.fetch_bytes = fetch_bytes
        base = os.path.dirname(os.path.abspath(cfg.database))
        backbone = getattr(cfg, "ml_backbone", "fashion")
        # eigener Datensatz je Bildmodell (die Fingerabdrücke verschiedener Modelle passen nicht zusammen)
        suffix = "" if backbone == "schnell" else f"_{backbone}"
        self.data = Dataset(os.path.join(base, f"ki_daten{suffix}.db"))
        self.model_path = os.path.join(base, f"ki_modell{suffix}.npz")
        self.embedder = embedder or Embedder(threads=cfg.ml_threads, backbone=backbone)
        self.models = load_models(self.model_path)
        self.report = report or (lambda text: None)
        self._queue: "queue.Queue[tuple[Any, str, Any]]" = queue.Queue(maxsize=2000)
        self._train_now = threading.Event()
        self.stop_event = threading.Event()
        self.collected_today = 0
        self.busy = ""
        self._ids: Optional[set[int]] = None   # welche Artikel schon im Datensatz sind (im Speicher)
        self._favs: dict[int, int] = {}

    @property
    def enabled(self) -> bool:
        return bool(self.cfg.ml_enabled) and self.embedder.installed() and not self.embedder.error

    # -- Sammeln -------------------------------------------------------------------------

    def collect(self, item: Any, ptype: str, est: Any) -> None:
        """Artikel in die Warteschlange zum Sammeln legen (läuft im Hintergrund)."""
        if not self.enabled or self.data.has(item.id):
            return
        try:
            self._queue.put_nowait((item, ptype, est))
        except queue.Full:
            pass  # zu viel auf einmal – dann eben nicht jeden Artikel

    def collect_blocking(self, item: Any, ptype: str, est: Any) -> None:
        """Wie collect, wartet aber, wenn die Warteschlange voll ist (Sammel-Turbo)."""
        if self.enabled and not self.data.has(item.id):
            while not self.stop_event.is_set():
                try:
                    self._queue.put((item, ptype, est), timeout=5)
                    return
                except queue.Full:
                    continue

    def _known(self) -> set[int]:
        if self._ids is None:
            self._ids = self.data.ids()
        return self._ids

    def seen_again(self, item: Any) -> None:
        """Favoriten wiedergesehener Artikel nachtragen – nur wenn sich etwas geändert hat (schont die Platte)."""
        if not self.enabled or item.id not in self._known():
            return
        if item.favourites > self._favs.get(item.id, -1):
            self._favs[item.id] = item.favourites
            self.data.seen_again(item.id, item.favourites)

    def _embed_item(self, item: Any, ptype: str, est: Any) -> Optional[tuple[np.ndarray, np.ndarray]]:
        cached = self.data.get_vectors(item.id)
        if cached is not None:
            return cached
        if not item.photo_url:
            return None
        blob = self.fetch_bytes(item.photo_url)
        if not blob:
            return None
        img = self.embedder.images([blob])[0]
        if img is None:
            return None
        txt = self.embedder.texts([f"{item.brand} {item.title}".strip()[:200]])[0]
        self.data.add(Sample(item_id=item.id, title=item.title, brand=est.brand, tier=est.tier or "",
                             family=family_of(ptype), cond=est.factor, kids="Kindergröße" in " ".join(est.factor_notes),
                             price=item.price, heur=est.value, created=item.created_ts, favs=item.favourites,
                             img=img, txt=txt))
        self.collected_today += 1
        self._known().add(item.id)
        return img, txt

    # -- Bewerten ------------------------------------------------------------------------

    def assess(self, item: Any, ptype: str, est: Any) -> Optional[BrainView]:
        if not self.enabled:
            return None
        try:
            vecs = self._embed_item(item, ptype, est)
        except Exception as e:  # noqa: BLE001
            self._fail(e)
            return None
        if vecs is None:
            return None
        img, txt = vecs
        view = BrainView()
        try:
            tags = getattr(self.embedder, "tags", None)
            if tags is not None:
                view.tags = tags(img)
                st = view.tag("stil")
                view.style, view.style_conf = (st.label, st.prob) if st else ("", 0.0)
                blurry = next((t.prob for t in view.tags if t.label == "unscharf/dunkel"), 0.0)
                view.photo_quality = 1.0 - blurry
                view.cool, view.cool_bits = cool_score(view.tags)
            else:
                view.style, view.style_conf, view.photo_quality = self.embedder.style(img)
        except Exception as e:  # noqa: BLE001
            log.debug("Tag-Erkennung fehlgeschlagen: %s", e)
        m = self.models
        x = features(img, txt, est.tier or "", family_of(ptype), est.factor,
                     "Kindergröße" in " ".join(est.factor_notes)).astype(np.float64)
        if any(isinstance(v, np.ndarray) and v.ndim == 1 and len(v) != len(x) for v in m.values()):
            return view  # Modell gehört zu einem anderen Bildmodell -> erst neu trainieren
        if "value_w" in m:
            view.value = float(math.exp(x @ m["value_w"]))
            view.value_trusted = bool(m.get("value_trusted"))
        if "pop_w" in m:
            view.popular = _sigmoid(float(x @ m["pop_w"]))
            view.popular_trusted = (m.get("pop_auc") or 0) >= 0.6
        if "taste_w" in m and (m.get("taste_auc") or 0) >= 0.6:
            view.taste = _sigmoid(float(x @ m["taste_w"]))
        if "fake_w" in m and (m.get("fake_auc") or 0) >= 0.7:
            view.fake = _sigmoid(float(x @ m["fake_w"]))
        return view

    def _fail(self, e: Exception) -> None:
        msg = str(e)[:200]
        if not self.embedder.error:
            log.warning("Eigenes Modell nicht verfügbar: %s", msg)
        self.embedder.error = msg

    # -- Labels ----------------------------------------------------------------------------

    def label_like(self, item_id: int, positive: bool) -> None:
        self.data.label(item_id, liked=1 if positive else -1)

    def label_fake(self, item_id: int, fake: bool) -> bool:
        return self.data.label(item_id, fake=1 if fake else 0)

    def label_ai(self, item_id: int, verdict: Any) -> None:
        values: dict[str, Any] = {"ai_value": verdict.wert_eur, "ai_look": verdict.look}
        if verdict.echtheit in ("fake_verdacht", "wahrscheinlich_echt"):
            values["fake"] = 1 if verdict.echtheit == "fake_verdacht" else 0
        self.data.label(item_id, **values)

    # -- Training ------------------------------------------------------------------------

    def train(self) -> TrainReport:
        self.busy = "trainiert"
        try:
            models, rep = train_models(self.data)
            if rep.samples >= 200:
                save_models(models, self.model_path)
                self.models = models
                self.data.set_meta("last_train", str(time.time()))
                self.data.set_meta("last_train_count", str(rep.samples))
            return rep
        finally:
            self.busy = ""

    def request_training(self) -> None:
        self._train_now.set()

    def status(self) -> dict[str, Any]:
        m = self.models
        last = float(self.data.get_meta("last_train", "0") or 0)
        return {"enabled": self.enabled, "installed": self.embedder.installed(), "error": self.embedder.error,
                "samples": self.data.count(), "today": self.collected_today, "queue": self._queue.qsize(),
                "last_train": last, "value_mape": m.get("value_mape"), "heur_mape": m.get("heur_mape"),
                "value_trusted": m.get("value_trusted", False), "pop_auc": m.get("pop_auc"),
                "taste_auc": m.get("taste_auc"), "fake_auc": m.get("fake_auc"),
                "likes": self.data.count("liked IS NOT NULL"), "fakes": self.data.count("fake IS NOT NULL"),
                "busy": self.busy, "backbone": getattr(self.embedder, "label", ""),
                "fallback": getattr(self.embedder, "fallback", ""), "tags": count_tags()}

    # -- Hintergrund-Thread: sammeln & regelmäßig trainieren -------------------------------

    def start(self) -> None:
        threading.Thread(target=self._run, name="KI-Training", daemon=True).start()

    def stop(self) -> None:
        self.stop_event.set()

    def _run(self) -> None:
        while not self.stop_event.is_set():
            if self._train_now.is_set() or self._training_due():
                self._train_now.clear()
                try:
                    rep = self.train()
                    log.info("Training fertig: %d Bilder, Wert-Abweichung %s", rep.samples,
                             f"{rep.value_mape:.0%}" if rep.value_mape is not None else "-")
                    self.report(rep.text())
                except Exception as e:  # noqa: BLE001
                    log.exception("Training fehlgeschlagen: %s", e)
            try:
                item, ptype, est = self._queue.get(timeout=2)
            except queue.Empty:
                continue
            if not self.enabled:
                continue
            try:
                self._embed_item(item, ptype, est)
            except Exception as e:  # noqa: BLE001
                self._fail(e)

    def _training_due(self) -> bool:
        if not self.enabled:
            return False
        last = float(self.data.get_meta("last_train", "0") or 0)
        last_n = int(self.data.get_meta("last_train_count", "0") or 0)
        if time.time() - last < self.cfg.ml_train_every_hours * 3600:
            return False
        return self.data.count() - last_n >= 200

    def drain(self, timeout: float = 3600) -> None:
        """Warten, bis alle gesammelten Artikel verarbeitet sind (für den Sammel-Turbo)."""
        end = time.time() + timeout
        while self._queue.qsize() and time.time() < end and not self.stop_event.is_set():
            time.sleep(1)
