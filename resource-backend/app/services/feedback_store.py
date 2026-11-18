"""Feedback storage (one JSON object per line) and the in-memory rate limit on posting it.

Nothing here knows who sent an entry. The rate limiter is keyed by client address, but only in
memory, and only for as long as that address has posts inside the window.
"""

import json
import logging
import threading
import time
from collections import deque
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)


class FeedbackStore:
    """An append-only JSON Lines file.

    A line is written in one call, under a lock shared by every store in the process, so two
    requests never interleave their lines. Lines are split on `\\n` alone: `json.dumps` escapes
    a newline inside a value, but with `ensure_ascii=False` it leaves U+2028, U+0085 and the like
    as they are, and `str.splitlines()` would break an entry at those.
    """

    _lock = threading.Lock()

    def __init__(self, path: Path):
        self.path = Path(path)

    def append(self, entry: dict) -> None:
        line = json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n"
        with self._lock:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("ab") as handle:
                handle.write(line.encode("utf-8"))

    def read_all(self) -> list[dict]:
        """Every entry, newest first. Lines that are not a JSON object are skipped and logged."""
        with self._lock:
            try:
                raw = self.path.read_bytes()
            except FileNotFoundError:
                return []
        entries = []
        for number, line in enumerate(raw.split(b"\n"), start=1):
            if not line.strip():
                continue
            try:
                entry = json.loads(line.decode("utf-8"))
            except (UnicodeDecodeError, ValueError) as e:
                logger.warning("feedback line %d skipped, unreadable: %s", number, e)
                continue
            if not isinstance(entry, dict):
                logger.warning("feedback line %d skipped, not an object", number)
                continue
            entries.append(entry)
        # Appended in the order they arrived, so the file's end is the newest.
        entries.reverse()
        return entries


class RateLimiter:
    """At most `limit` allowed calls per key in any `window_s` seconds (sliding window).

    A refused call is not recorded, so a client that keeps trying is let in again as soon as its
    oldest allowed call ages out. Keys with nothing left in the window are swept at most once per
    window, which keeps memory bounded by the addresses active in the last two windows.
    """

    def __init__(self, limit: int, window_s: float, clock: Callable[[], float] = time.monotonic):
        self.limit = limit
        self.window_s = window_s
        self._clock = clock
        self._lock = threading.Lock()
        self._hits: dict[str, deque] = {}
        self._last_sweep = clock()

    def allow(self, key: str) -> bool:
        with self._lock:
            now = self._clock()
            cutoff = now - self.window_s
            if now - self._last_sweep >= self.window_s:
                self._hits = {k: hits for k, hits in self._hits.items() if hits and hits[-1] > cutoff}
                self._last_sweep = now
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def tracked(self) -> int:
        """How many keys are held in memory."""
        with self._lock:
            return len(self._hits)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()
            self._last_sweep = self._clock()
