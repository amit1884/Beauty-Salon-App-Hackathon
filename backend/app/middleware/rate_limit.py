"""Simple in-memory rate limiting per client IP (suitable for single-instance deploys)."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.config import settings

_WINDOW_SECONDS = 60


class _SlidingWindowCounter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def hit(self, key: str, window_seconds: int = _WINDOW_SECONDS) -> int:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            hits = [t for t in self._hits[key] if t > cutoff]
            hits.append(now)
            self._hits[key] = hits
            return len(hits)


_counter = _SlidingWindowCounter()


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _limit_for(request: Request) -> int:
    path = request.url.path
    if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
        return settings.rate_limit_auth_per_minute
    if path.startswith("/api/agent/"):
        return settings.rate_limit_agent_per_minute
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        return settings.rate_limit_write_per_minute
    return settings.rate_limit_per_minute


def _bucket_key(request: Request) -> str:
    path = request.url.path
    if path.startswith("/api/auth/"):
        return f"{client_ip(request)}:auth"
    if path.startswith("/api/agent/"):
        return f"{client_ip(request)}:agent"
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        return f"{client_ip(request)}:write"
    return f"{client_ip(request)}:read"


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.rate_limit_enabled:
            return await call_next(request)

        if request.method == "OPTIONS" or request.url.path in ("/health", "/docs", "/openapi.json"):
            return await call_next(request)

        key = _bucket_key(request)
        limit = _limit_for(request)
        count = _counter.hit(key)

        if count > limit:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please wait a minute and try again."},
                headers={"Retry-After": str(_WINDOW_SECONDS)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(max(0, limit - count))
        return response
