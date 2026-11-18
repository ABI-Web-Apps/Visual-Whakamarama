"""What the feedback and Stay in touch routers share: the review password, the client key their
rate limits use, UTC time stamps and error bodies."""

import hmac
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import Header, HTTPException, Request

from app.utils.setup import Config

#: What a wrong password costs, so guessing one is slow.
BAD_PASSWORD_DELAY_S = 0.4

#: Review responses list what readers sent; no browser may keep them.
NO_STORE = {"Cache-Control": "no-store"}


def api_error(status: int, code: str, summary: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "summary": summary})


def require_review_password(password: Optional[str] = Header(None, alias="X-Feedback-Password")) -> None:
    """The dependency every review route (list or delete, feedback or Stay in touch) runs first.

    401 `bad_password` after `BAD_PASSWORD_DELAY_S` unless `X-Feedback-Password` matches
    `FEEDBACK_ADMIN_PASSWORD`. A plain `def`, so FastAPI runs it, and the delay, in the
    threadpool rather than on the event loop. An empty password, sent or configured, never
    unlocks anything.
    """
    expected = Config.FEEDBACK_ADMIN_PASSWORD
    if not password or not expected or not hmac.compare_digest(password.encode("utf-8"), expected.encode("utf-8")):
        time.sleep(BAD_PASSWORD_DELAY_S)
        raise api_error(401, "bad_password", "Wrong password.")


def client_key(request: Request) -> str:
    """The first X-Forwarded-For hop (both nginx layers append to it), else the peer address.

    Used only as a rate-limit key in memory; never stored.
    """
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def utc_now() -> str:
    """Now in UTC, ISO 8601 to the millisecond with a `Z`: 2026-11-18T03:04:05.678Z."""
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
