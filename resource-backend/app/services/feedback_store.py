"""Storage for what readers send (one JSON object per line) and the in-memory rate limit on it.

Nothing here knows who sent an entry. The rate limiter is keyed by client address, but only in
memory, and only for as long as that address has posts inside the window.
"""

import json
import logging
import os
import threading
import time
import uuid
from collections import deque
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

_NL = b"\n"


def _encode(entry: dict) -> bytes:
    return json.dumps(entry, ensure_ascii=False, separators=(",", ":")).encode("utf-8") + _NL


def _decode(line: bytes) -> dict | None:
    """The entry on a line; None for a blank line, a broken one, or one that is not an object."""
    if not line.strip():
        return None
    try:
        entry = json.loads(line.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return None
    return entry if isinstance(entry, dict) else None


class FeedbackStore:
    """A JSON Lines file in FEEDBACK_DIR: `feedback.jsonl`, or `subscribers.jsonl`.

    Every read and write holds a lock shared by every store in the process, so two requests
    never interleave their lines and a rewrite never races an append. An append adds one line;
    `delete` and `upsert` rewrite the file atomically (a temp file in the same folder, then
    `os.replace`), and every line they do not remove or change is written back byte for byte.

    Lines are split on LF alone: `json.dumps` escapes a newline inside a value, but with
    `ensure_ascii=False` it leaves U+2028, U+0085 and the like as they are, and
    `str.splitlines()` would break an entry at those.
    """

    _lock = threading.Lock()

    def __init__(self, path: Path):
        self.path = Path(path)

    def append(self, entry: dict) -> None:
        with self._lock:
            self._append_locked(_encode(entry))

    def read_all(self) -> list[dict]:
        """Every entry, newest first. Lines that are not a JSON object are skipped and logged."""
        with self._lock:
            lines = self._lines_locked()
        entries = []
        for number, line in enumerate(lines, start=1):
            if not line.strip():
                continue
            entry = _decode(line)
            if entry is None:
                logger.warning("%s line %d skipped: not a JSON object", self.path.name, number)
                continue
            entries.append(entry)
        # Appended in the order they arrived, so the file's end is the newest.
        entries.reverse()
        return entries

    def delete(self, entry_id: str) -> bool:
        """Remove the entry with this `id`. False when there is none."""
        with self._lock:
            lines = self._lines_locked()
            kept = [line for line in lines if (_decode(line) or {}).get("id") != entry_id]
            if len(kept) == len(lines):
                return False
            self._rewrite_locked(kept)
            return True

    def upsert(self, match: Callable[[dict], bool], entry: dict, changes: dict) -> tuple[dict, bool]:
        """The first stored entry `match` accepts, with `changes` applied (and written back when
        they change it), and False; or, when none matches, `entry` appended, and True."""
        with self._lock:
            lines = self._lines_locked()
            for index, line in enumerate(lines):
                stored = _decode(line)
                if stored is None or not match(stored):
                    continue
                updated = {**stored, **changes}
                if updated != stored:
                    lines[index] = _encode(updated)[: -len(_NL)]
                    self._rewrite_locked(lines)
                return updated, False
            self._append_locked(_encode(entry))
            return entry, True

    def _lines_locked(self) -> list[bytes]:
        try:
            return self.path.read_bytes().split(_NL)
        except FileNotFoundError:
            return []

    def _append_locked(self, data: bytes) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a+b") as handle:
            # A last line without its newline (a hand edit, a crash mid-write) must not swallow
            # the entry written after it.
            if handle.seek(0, os.SEEK_END) > 0:
                handle.seek(-1, os.SEEK_END)
                if handle.read(1) != _NL:
                    data = _NL + data
            handle.write(data)

    def _rewrite_locked(self, lines: list[bytes]) -> None:
        data = _NL.join(lines)
        if data and not data.endswith(_NL):
            data += _NL
        tmp = self.path.with_name(f".{self.path.name}.{uuid.uuid4().hex}.tmp")
        try:
            with tmp.open("wb") as handle:
                handle.write(data)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(tmp, self.path)
        finally:
            tmp.unlink(missing_ok=True)


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
        """Record a call for `key` and say yes, or say no (recording nothing) when it is full."""
        with self._lock:
            now, hits = self._current(key)
            if len(hits) >= self.limit:
                return False
            hits.append(now)
            return True

    def blocked(self, key: str) -> bool:
        """Whether `key` has used up the window, without recording anything."""
        with self._lock:
            return len(self._current(key)[1]) >= self.limit

    def record(self, key: str) -> None:
        """Count one event for `key`, full or not (a failure to be counted, say)."""
        with self._lock:
            now, hits = self._current(key)
            hits.append(now)

    def _current(self, key: str) -> tuple[float, deque]:
        """Now, and `key`'s calls still inside the window. Called with the lock held."""
        now = self._clock()
        cutoff = now - self.window_s
        if now - self._last_sweep >= self.window_s:
            self._hits = {k: hits for k, hits in self._hits.items() if hits and hits[-1] > cutoff}
            self._last_sweep = now
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= cutoff:
            hits.popleft()
        return now, hits

    def tracked(self) -> int:
        """How many keys are held in memory."""
        with self._lock:
            return len(self._hits)

    def clear(self) -> None:
        with self._lock:
            self._hits.clear()
            self._last_sweep = self._clock()
