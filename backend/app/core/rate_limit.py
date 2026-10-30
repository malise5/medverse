"""Fixed-window rate limiter backed by Redis, with an in-process fallback.

The fallback keeps local development and tests working without Redis; it is
per-process and therefore not suitable for multi-instance production deployments.
"""

import logging
import threading
import time

import redis

from app.core.config import get_settings

log = logging.getLogger("medverse.rate_limit")


class RateLimiter:
    def __init__(self, redis_url: str | None) -> None:
        self._redis: redis.Redis | None = None
        if redis_url:
            try:
                client = redis.Redis.from_url(redis_url, socket_timeout=0.5)
                client.ping()
                self._redis = client
            except redis.RedisError:
                log.warning("Redis unavailable; using in-memory rate limiting")
        self._memory: dict[str, tuple[int, float]] = {}
        self._lock = threading.Lock()

    @property
    def backend(self) -> str:
        return "redis" if self._redis else "memory"

    def hit(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        """Record one hit. Returns (allowed, seconds_until_reset)."""
        if self._redis is not None:
            try:
                pipe = self._redis.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds, nx=True)
                pipe.ttl(key)
                count, _, ttl = pipe.execute()
                return count <= limit, max(int(ttl), 0)
            except redis.RedisError:
                log.warning("Redis error during rate limiting; falling back to memory")
        now = time.monotonic()
        with self._lock:
            count, reset_at = self._memory.get(key, (0, now + window_seconds))
            if now >= reset_at:
                count, reset_at = 0, now + window_seconds
            count += 1
            self._memory[key] = (count, reset_at)
            return count <= limit, int(reset_at - now)

    def reset(self) -> None:
        self._memory.clear()


_limiter: RateLimiter | None = None


def get_rate_limiter() -> RateLimiter:
    global _limiter
    if _limiter is None:
        _limiter = RateLimiter(get_settings().redis_url)
    return _limiter
