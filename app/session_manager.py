"""In-memory store of the quiz sessions (user_vector, asked_ids, current question, ...).

Sessions live in this process only: they are lost on restart and are not shared between
workers or replicas, so run the API as a single process.
"""
from __future__ import annotations

import asyncio
import copy
import threading
import time
import weakref
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class _Session:
    data: dict[str, Any] = field(default_factory=dict)
    expires_at: float = 0.0


class SessionManager:
    """Per-user key/value sessions that expire `ttl_seconds` after their last use."""

    def __init__(self, ttl_seconds: float = 3600.0,
                 clock: Callable[[], float] = time.monotonic,
                 sweep_interval: float | None = None) -> None:
        """
        ttl_seconds    : a session is kept this long after its last get/set/asked_ids/add_asked
        clock          : returns the current time in seconds (injectable for tests)
        sweep_interval : creating a session also purges the expired ones, at most this often,
                         so abandoned sessions cannot pile up. Default: min(60, ttl)
        Every call is thread-safe; the internal lock is never held across an await (use
        user_lock() for that).
        """
        if ttl_seconds <= 0:
            raise ValueError("ttl_seconds must be positive")
        if sweep_interval is not None and sweep_interval <= 0:
            raise ValueError("sweep_interval must be positive")
        self._ttl = float(ttl_seconds)
        self._clock = clock
        self._sweep_interval = float(sweep_interval) if sweep_interval is not None else min(60.0, self._ttl)
        self._last_sweep = clock()
        self._lock = threading.RLock()
        self._sessions: dict[str, _Session] = {}
        # per-user asyncio locks; weak values: a lock disappears once nobody holds or awaits it
        self._user_locks: weakref.WeakValueDictionary[str, asyncio.Lock] = weakref.WeakValueDictionary()

    # ── internals ────────────────────────────────────────────────────────────
    @staticmethod
    def _sid(user_id: Any) -> str:
        """user_id (a UUID or a string) as the string key."""
        if not user_id:
            raise ValueError("user_id is missing or empty")
        return str(user_id)

    @staticmethod
    def _check_key(key: Any) -> str:
        """Return the key if it is a non-blank string, otherwise raise ValueError."""
        if not isinstance(key, str) or not key.strip():
            raise ValueError("key is missing or not a string")
        return key

    @staticmethod
    def _isolate(value: Any) -> Any:
        """Copy mutable values on the way in and out so callers never alias stored state."""
        if isinstance(value, np.ndarray):
            return value.copy()
        if isinstance(value, (list, dict, set)):
            return copy.deepcopy(value)
        return value

    def _purge_locked(self, now: float) -> int:
        """Delete every expired session. Caller holds the lock."""
        expired = [sid for sid, s in self._sessions.items() if s.expires_at <= now]
        for sid in expired:
            del self._sessions[sid]
        self._last_sweep = now
        return len(expired)

    def _live(self, sid: str, create: bool = False, touch: bool = True) -> _Session:
        """Return the unexpired session (extending its TTL unless touch=False).
        Raises ValueError if it is missing/expired and create is False. Caller holds the lock."""
        now = self._clock()
        sess = self._sessions.get(sid)
        if sess is not None and sess.expires_at <= now:
            del self._sessions[sid]
            sess = None
        if sess is None:
            if not create:
                raise ValueError("session expired or doesnt exist")
            if now - self._last_sweep >= self._sweep_interval:
                self._purge_locked(now)               # amortised cleanup of abandoned sessions
            sess = self._sessions[sid] = _Session()
            touch = True
        if touch:
            sess.expires_at = now + self._ttl
        return sess

    def _peek(self, sid: str, touch: bool = True) -> _Session | None:
        """Live session or None."""
        try:
            return self._live(sid, touch=touch)
        except ValueError:
            return None

    # ── concurrency ──────────────────────────────────────────────────────────
    def user_lock(self, user_id: Any) -> asyncio.Lock:
        """Per-user asyncio lock. Hold it (async with) across a whole read -> await -> write
        sequence so two requests of the same user cannot interleave. Not reentrant."""
        sid = self._sid(user_id)
        with self._lock:
            lock = self._user_locks.get(sid)
            if lock is None:
                lock = self._user_locks[sid] = asyncio.Lock()
            return lock

    # ── public API ───────────────────────────────────────────────────────────
    def set(self, user_id: Any, key: str, value: Any) -> None:
        """Set a key-value pair in the session for the given user_id (creating the session)."""
        sid, key = self._sid(user_id), self._check_key(key)
        with self._lock:
            self._live(sid, create=True).data[key] = self._isolate(value)

    def get(self, user_id: Any, key: str, default: Any = None) -> Any:
        """Get a copy of the value for a key, returning default if the key or session is missing.
        Extends the TTL."""
        sid, key = self._sid(user_id), self._check_key(key)
        with self._lock:
            sess = self._peek(sid)
            if sess is None or key not in sess.data:
                return default
            return self._isolate(sess.data[key])

    def has(self, user_id: Any, key: str | None = None) -> bool:
        """Check if the session (or a key in it) exists. Does NOT extend the TTL."""
        sid = self._sid(user_id)
        with self._lock:
            sess = self._peek(sid, touch=False)
            if sess is None:
                return False
            return True if key is None else self._check_key(key) in sess.data

    def asked_ids(self, user_id: Any) -> list:
        """A COPY of the asked ids (empty if none yet). Raises ValueError if the session is
        missing or expired. Record a new question with add_asked()."""
        sid = self._sid(user_id)
        with self._lock:
            return list(self._live(sid).data.get("asked_ids", []))

    def add_asked(self, user_id: Any, question_id: Any) -> bool:
        """Append question_id to the asked ids under the lock (idempotent).
        Returns True if it was added, False if it was already there.
        Raises ValueError if the session is missing or expired."""
        sid = self._sid(user_id)
        with self._lock:
            asked = self._live(sid).data.setdefault("asked_ids", [])
            if any(str(a) == str(question_id) for a in asked):
                return False
            asked.append(question_id)
            return True

    def delete(self, user_id: Any, key: str | None = None) -> bool:
        """Delete one key, or the whole session when key is None. Returns True if something
        was deleted. Does NOT extend the TTL."""
        sid = self._sid(user_id)
        with self._lock:
            sess = self._peek(sid, touch=False)
            if sess is None:
                return False
            if key is None:
                del self._sessions[sid]
                return True
            key = self._check_key(key)
            if key not in sess.data:
                return False
            del sess.data[key]
            return True

    def purge_expired(self) -> int:
        """Delete every expired session now; returns how many were removed."""
        with self._lock:
            return self._purge_locked(self._clock())

    def __len__(self) -> int:
        """Number of live (unexpired) sessions."""
        with self._lock:
            now = self._clock()
            return sum(1 for s in self._sessions.values() if s.expires_at > now)
