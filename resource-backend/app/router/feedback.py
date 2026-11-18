"""Anonymous in-app feedback: readers post it, the team lists and deletes it behind a password.

Stored in `<FEEDBACK_DIR>/feedback.jsonl`, one entry per line: what the reader typed plus the
page, device class, app version and mode the frontend sends, an `id` (uuid4) and `created_at`
(UTC). Never an IP address, a user agent or a name. The client address is used only by the
in-memory rate limit and is never written anywhere.

FEEDBACK_DIR is a named volume (`feedback_data`) in both compose files, so a rebuild or redeploy
keeps it. The portal's "delete plugin" runs `docker compose down --volumes`, which does not:
export the CSV from the review page first.
"""

import uuid
from typing import Annotated, Literal, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.router.common import NO_STORE, api_error, client_key, require_review_password, utc_now
from app.services.feedback_store import FeedbackStore, RateLimiter
from app.utils.setup import Config

router = APIRouter()

#: Posts allowed per client address in a sliding window. Generous for a reader leaving a note on
#: a few pages; a stuck retry loop or a script hits it quickly.
rate_limiter = RateLimiter(limit=20, window_s=600)


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


@router.post("/api/feedback", status_code=201)
def post_feedback(body: FeedbackIn, request: Request) -> dict:
    if not rate_limiter.allow(client_key(request)):
        raise api_error(429, "rate_limited", "Too many messages — please try again later.")
    receipt = {"id": str(uuid.uuid4()), "created_at": utc_now()}
    _store().append({**receipt, **body.model_dump()})
    return receipt


@router.get("/api/feedback", dependencies=[Depends(require_review_password)])
def list_feedback():
    """Every entry, newest first."""
    items = _store().read_all()
    return JSONResponse(content={"total": len(items), "items": items}, headers=NO_STORE)


@router.delete("/api/feedback/{entry_id}", status_code=204, dependencies=[Depends(require_review_password)])
def delete_feedback(entry_id: str):
    if not _store().delete(entry_id):
        raise api_error(404, "not_found", "That entry no longer exists.")
    return Response(status_code=204)
