"""What the feedback and Stay in touch routers share: the review password, the client key their
rate limits use, UTC time stamps and error bodies."""

import asyncio
import hmac
import ipaddress
from datetime import datetime, timezone
from typing import Optional

from fastapi import Header, HTTPException, Request

from app.services.feedback_store import RateLimiter
from app.utils.setup import Config

#: What a wrong password costs, so guessing one is slow.
BAD_PASSWORD_DELAY_S = 0.4

#: Wrong review passwords allowed per client address in a sliding window; past it, the address
#: is refused outright until the oldest failure ages out.
password_failures = RateLimiter(limit=10, window_s=600)

#: The awaited delay (a module attribute so tests can skip the wait).
_sleep = asyncio.sleep

#: Review responses list what readers sent; no browser may keep them.
NO_STORE = {"Cache-Control": "no-store"}


def api_error(status: int, code: str, summary: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "summary": summary})


async def require_review_password(
    request: Request,
    password: Optional[str] = Header(None, alias="X-Feedback-Password"),
) -> None:
    """The dependency every review route (list or delete, feedback or Stay in touch) runs first.

    429 `too_many_attempts` once the client (`client_key`) has had `password_failures.limit`
    wrong passwords inside the window -- refused before the password is compared, so the right
    one is refused too until the window moves on. Otherwise 401 `bad_password`, after
    `BAD_PASSWORD_DELAY_S`, unless `X-Feedback-Password` matches `FEEDBACK_ADMIN_PASSWORD`; only
    these failures count. An empty password, sent or configured, never unlocks anything.

    `async`, and the delay awaited: a flood of wrong passwords then waits on the event loop
    instead of holding the threadpool workers that serve the MRI, the meshes and the catalogue.
    """
    key = client_key(request)
    if password_failures.blocked(key):
        raise api_error(429, "too_many_attempts", "Too many wrong passwords — try again later.")
    expected = Config.FEEDBACK_ADMIN_PASSWORD
    if not password or not expected or not hmac.compare_digest(password.encode("utf-8"), expected.encode("utf-8")):
        # Counted before the delay, so guesses sent in parallel are counted as they arrive.
        password_failures.record(key)
        await _sleep(BAD_PASSWORD_DELAY_S)
        raise api_error(401, "bad_password", "Wrong password.")


def _ip(text: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    try:
        return ipaddress.ip_address(text.strip())
    except ValueError:
        return None


def client_key(request: Request) -> str:
    """The address a rate limit counts a request against. Used only in memory; never stored.

    Every nginx layer appends the address it saw to X-Forwarded-For
    (`$proxy_add_x_forwarded_for`), so the right of the header is written by our proxies and the
    left by the client, who can put anything there. Walking from the right, the first global
    address is the one the outermost proxy saw: the client's real one. Entries that are not an
    IP address are skipped. With no global entry (a reader on the same private network), the
    right-most valid entry; with no valid entry at all, the peer address.
    """
    hops = [ip for ip in map(_ip, request.headers.get("x-forwarded-for", "").split(",")) if ip is not None]
    for ip in reversed(hops):
        if ip.is_global:
            return str(ip)
    if hops:
        return str(hops[-1])
    return request.client.host if request.client else "unknown"


def utc_now() -> str:
    """Now in UTC, ISO 8601 to the millisecond with a `Z`: 2026-11-18T03:04:05.678Z."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
