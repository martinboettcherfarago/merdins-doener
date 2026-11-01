"""SQLite-Speicher: gesehene Artikel, Preisverlauf, per Telegram angelegte Suchen, Zustand."""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from typing import Optional

from .config import SearchConfig
from .models import Item

SCHEMA = """
CREATE TABLE IF NOT EXISTS seen (
    search TEXT NOT NULL,
    item_id INTEGER NOT NULL,
    price REAL NOT NULL,
    first_seen REAL NOT NULL,
    PRIMARY KEY (search, item_id)
);
CREATE TABLE IF NOT EXISTS prices (
    search TEXT NOT NULL,
    price REAL NOT NULL,
    ts REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS prices_search ON prices (search, ts);
CREATE TABLE IF NOT EXISTS items (
    item_id INTEGER PRIMARY KEY,
    data TEXT NOT NULL,
    ts REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS searches (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


class Storage:
    def __init__(self, path: str):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.executescript(SCHEMA)
        self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # -- gesehene Artikel --------------------------------------------------------

    def seen_price(self, search: str, item_id: int) -> Optional[float]:
        with self._lock:
            row = self._db.execute("SELECT price FROM seen WHERE search=? AND item_id=?",
                                   (search, item_id)).fetchone()
        return row[0] if row else None

    def mark_seen(self, search: str, item: Item) -> None:
        now = time.time()
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO seen (search, item_id, price, first_seen) "
                             "VALUES (?, ?, ?, COALESCE((SELECT first_seen FROM seen WHERE search=? AND item_id=?), ?))",
                             (search, item.id, item.price, search, item.id, now))
            self._db.commit()

    def add_price(self, search: str, price: float) -> None:
        with self._lock:
            self._db.execute("INSERT INTO prices (search, price, ts) VALUES (?, ?, ?)", (search, price, time.time()))
            self._db.commit()

    def price_history(self, search: str, limit: int = 300) -> list[float]:
        with self._lock:
            rows = self._db.execute("SELECT price FROM prices WHERE search=? ORDER BY ts DESC LIMIT ?",
                                    (search, limit)).fetchall()
        return [r[0] for r in rows]

    def is_seeded(self, search: str) -> bool:
        return self.get_state(f"seeded:{search}") == "1"

    def set_seeded(self, search: str) -> None:
        self.set_state(f"seeded:{search}", "1")

    def forget_search(self, search: str) -> None:
        with self._lock:
            for table in ("seen", "prices"):
                self._db.execute(f"DELETE FROM {table} WHERE search=?", (search,))
            self._db.execute("DELETE FROM state WHERE key IN (?, ?)", (f"seeded:{search}", f"disabled:{search}"))
            self._db.commit()

    def cleanup(self, days: int = 30) -> None:
        cutoff = time.time() - days * 86400
        with self._lock:
            self._db.execute("DELETE FROM seen WHERE first_seen < ?", (cutoff,))
            self._db.execute("DELETE FROM prices WHERE ts < ?", (cutoff,))
            self._db.execute("DELETE FROM items WHERE ts < ?", (cutoff,))
            self._db.commit()

    # -- gemerkte Artikel (für Angebote per Button) ------------------------------

    def save_item(self, item: Item) -> None:
        data = {"id": item.id, "title": item.title, "price": item.price, "currency": item.currency,
                "url": item.url, "seller_id": item.seller_id}
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO items (item_id, data, ts) VALUES (?, ?, ?)",
                             (item.id, json.dumps(data), time.time()))
            self._db.commit()

    def get_item(self, item_id: int) -> Optional[dict]:
        with self._lock:
            row = self._db.execute("SELECT data FROM items WHERE item_id=?", (item_id,)).fetchone()
        return json.loads(row[0]) if row else None

    # -- per Telegram angelegte Suchen --------------------------------------------

    def custom_searches(self) -> list[SearchConfig]:
        with self._lock:
            rows = self._db.execute("SELECT data FROM searches ORDER BY rowid").fetchall()
        return [SearchConfig.from_dict(json.loads(r[0]), source="telegram") for r in rows]

    def add_search(self, search: SearchConfig) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO searches (name, data) VALUES (?, ?)",
                             (search.name, json.dumps(search.to_dict())))
            self._db.commit()

    def delete_search(self, name: str) -> bool:
        with self._lock:
            cur = self._db.execute("DELETE FROM searches WHERE name=?", (name,))
            self._db.commit()
            return cur.rowcount > 0

    # -- Zustand -------------------------------------------------------------------

    def get_state(self, key: str, default: Optional[str] = None) -> Optional[str]:
        with self._lock:
            row = self._db.execute("SELECT value FROM state WHERE key=?", (key,)).fetchone()
        return row[0] if row else default

    def set_state(self, key: str, value: str) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO state (key, value) VALUES (?, ?)", (key, value))
            self._db.commit()

    def delete_state(self, key: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM state WHERE key=?", (key,))
            self._db.commit()

    def is_disabled(self, search: str) -> bool:
        return self.get_state(f"disabled:{search}") == "1"

    def set_disabled(self, search: str, disabled: bool) -> None:
        if disabled:
            self.set_state(f"disabled:{search}", "1")
        else:
            self.delete_state(f"disabled:{search}")
