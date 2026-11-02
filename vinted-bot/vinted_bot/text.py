"""Kleine Text-Helfer, die überall gebraucht werden."""

from __future__ import annotations

import re
import unicodedata


def normalize(text: str) -> str:
    """'Arc'teryx' -> 'arcteryx', 'Stüssy' -> 'stussy', 'Levi's' -> 'levis'."""
    t = unicodedata.normalize("NFKD", text or "")
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", t.lower())


def keyword_pattern(word: str) -> str:
    """Regulärer Ausdruck zu einem Erkennungswort (siehe keyword_in)."""
    if word.startswith("="):
        core = word[1:]
        whole = core.endswith("=")
        core = core.rstrip("=")
        end = r"(?![a-zäöüß0-9])" if whole else ""
        return rf"(?<![a-zäöüß0-9]){re.escape(core)}{end}"
    return re.escape(word)


def keyword_in(text: str, word: str) -> bool:
    """Erkennungswort im (kleingeschriebenen) Text finden.

    'wort'   – irgendwo, auch in zusammengesetzten Wörtern ('Winterjacke' enthält 'jacke')
    '=wort'  – am Wortanfang ('cap' passt zu 'Cappy', aber nicht zu 'Escape')
    '=wort=' – nur als ganzes Wort ('top' passt nicht zu 'Topf')
    """
    if word.startswith("="):
        core = word[1:]
        whole = core.endswith("=")
        core = core.rstrip("=")
        end = r"(?![a-zäöüß0-9])" if whole else ""
        return re.search(rf"(?<![a-zäöüß0-9]){re.escape(core)}{end}", text) is not None
    return word in text
