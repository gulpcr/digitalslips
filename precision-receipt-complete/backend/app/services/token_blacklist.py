# app/services/token_blacklist.py
"""
Token blacklist for invalidating JWT tokens on logout.
Uses an in-memory set with TTL-based cleanup.
In production with multiple instances, replace with Redis.
"""
import threading
import time
import logging
from typing import Set

from app.core.config import settings

logger = logging.getLogger(__name__)

# Token expiry in seconds (match JWT access token lifetime)
_TOKEN_TTL = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60


class TokenBlacklist:
    """Thread-safe in-memory token blacklist with automatic expiry cleanup."""

    def __init__(self) -> None:
        self._tokens: dict[str, float] = {}  # token -> expiry timestamp
        self._lock = threading.Lock()

    def blacklist(self, token: str) -> None:
        """Add a token to the blacklist."""
        with self._lock:
            self._tokens[token] = time.time() + _TOKEN_TTL
        self._cleanup()

    def is_blacklisted(self, token: str) -> bool:
        """Check if a token is blacklisted."""
        with self._lock:
            expiry = self._tokens.get(token)
            if expiry is None:
                return False
            if time.time() > expiry:
                del self._tokens[token]
                return False
            return True

    def _cleanup(self) -> None:
        """Remove expired entries."""
        now = time.time()
        with self._lock:
            expired = [t for t, exp in self._tokens.items() if now > exp]
            for t in expired:
                del self._tokens[t]


# Singleton instance
token_blacklist = TokenBlacklist()
