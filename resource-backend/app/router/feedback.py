"""Anonymous in-app feedback: readers post it, the team lists it behind a password.

Stored in `<FEEDBACK_DIR>/feedback.jsonl`, one entry per line: what the reader typed plus the
page, device class, app version and mode the frontend sends, an `id` (uuid4) and `created_at`
(UTC). Never an IP address, a user agent or a name. The client address is used only by the
in-memory rate limit and is never written anywhere.

FEEDBACK_DIR is a named volume (`feedback_data`) in both compose files, so a rebuild or redeploy
keeps it. The portal's "delete plugin" runs `docker compose down --volumes`, which does not:
export the CSV from the review page first.
"""

import hmac
import time
import uuid
from datetime import datetime, timezone
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.services.feedback_store import FeedbackStore, RateLimiter
from app.utils.setup import Config

router = APIRouter()

#: Posts allowed per client address in a sliding window. Generous for a reader leaving a note on
#: a few pages; a stuck retry loop or a script hits it quickly.
rate_limiter = RateLimiter(limit=20, window_s=600)

#: What a wrong password costs, so guessing one is slow.
_BAD_PASSWORD_DELAY_S = 0.4


def _error(status: int, code: str, summary: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "summary": summary})


class FeedbackIn(BaseModel):
    """A reader's entry. A rating, a non-blank comment, or both."""

    model_config = ConfigDict(extra="forbid")

    # Strict: a string, a float or a boolean is not a rating.
    rating: Optional[Annotated[int, Field(strict=True, ge=1, le=5)]] = None
    comment: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""
    page: Annotated[str, Field(max_length=200)]
    device: Literal["phone", "tablet", "desktop"]
    app_version: Annotated[str, Field(max_length=32)]
    mode: Literal["plugin", "standalone"]

    @model_validator(mode="after")
    def _rating_or_comment(self) -> "FeedbackIn":
        if self.rating is None and not self.comment:
            raise ValueError("Give a rating, a comment, or both.")
        return self


def _store() -> FeedbackStore:
    return FeedbackStore(Config.FEEDBACK_DIR / "feedback.jsonl")


def _client_key(request: Request) -> str:
    """The first X-Forwarded-For hop (both nginx layers append to it), else the peer address."""
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@router.post("/api/feedback", status_code=201)
def post_feedback(body: FeedbackIn, request: Request) -> dict:
    if not rate_limiter.allow(_client_key(request)):
        raise _error(429, "rate_limited", "Too many messages — please try again later.")
    receipt = {"id": str(uuid.uuid4()), "created_at": _utc_now()}
    _store().append({**receipt, **body.model_dump()})
    return receipt


@router.get("/api/feedback")
def list_feedback(password: Optional[str] = Header(None, alias="X-Feedback-Password")):
    """Every entry, newest first. A plain `def` route: the delay on a wrong password sleeps a
    threadpool worker, not the event loop."""
    expected = Config.FEEDBACK_ADMIN_PASSWORD
    # An empty password, sent or configured, never unlocks anything.
    if not password or not expected or not hmac.compare_digest(password.encode("utf-8"), expected.encode("utf-8")):
        time.sleep(_BAD_PASSWORD_DELAY_S)
        raise _error(401, "bad_password", "Wrong password.")
    items = _store().read_all()
    return JSONResponse(content={"total": len(items), "items": items}, headers={"Cache-Control": "no-store"})
