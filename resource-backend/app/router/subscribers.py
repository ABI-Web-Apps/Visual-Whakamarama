"""Stay in touch: readers leave an email address or a mobile number (and, if they like, a first
name) to hear how the project is going; the team lists and deletes them behind the review
password.

Stored in `<FEEDBACK_DIR>/subscribers.jsonl`, apart from feedback, so nothing ties a comment to
a contact. One line per contact: `{id, created_at, first_name, contact, contact_type}`, the
contact normalised (see `classify_contact`). Signing up again with the same contact keeps that
line, its `id` and its `created_at`, and updates the first name when a new one is given. As with
feedback, the client address is used only by the in-memory rate limit, never stored.
"""

import re
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ConfigDict, StringConstraints

from app.router.common import NO_STORE, api_error, client_key, require_review_password, utc_now
from app.services.feedback_store import FeedbackStore, RateLimiter
from app.utils.setup import Config

router = APIRouter()

#: Sign-ups allowed per client address in a sliding window. A household signing up a few people
#: fits; a script trying contacts does not.
rate_limiter = RateLimiter(limit=10, window_s=600)

MAX_CONTACT_LENGTH = 254

#: Something@domain.tld: no spaces, one @, and a dot-separated domain with no empty label.
_EMAIL = re.compile(r"[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+")
#: What people put between a phone number's digits: spaces, dashes, dots and brackets.
_PHONE_SEPARATORS = re.compile(r"[\s().-]")
#: An optional leading + and 7 to 15 ASCII digits (E.164 allows at most 15).
_PHONE = re.compile(r"\+?[0-9]{7,15}")


def classify_contact(raw: str) -> tuple[str, str] | None:
    """`(contact, "email" | "phone")` normalised for storage, or None when it is neither.

    Trimmed first. An email is lower-cased. A phone number has its separators removed and must
    then be an optional + and 7 to 15 digits. Over `MAX_CONTACT_LENGTH` characters is neither.
    """
    text = raw.strip()
    if not text or len(text) > MAX_CONTACT_LENGTH:
        return None
    email = text.lower()
    if _EMAIL.fullmatch(email):
        return email, "email"
    phone = _PHONE_SEPARATORS.sub("", text)
    if _PHONE.fullmatch(phone):
        return phone, "phone"
    return None


class SubscriberIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    first_name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    # Checked by classify_contact, so a bad one gets the `invalid_contact` body the form shows.
    contact: str


def _store() -> FeedbackStore:
    return FeedbackStore(Config.FEEDBACK_DIR / "subscribers.jsonl")


@router.post("/api/subscribers", status_code=201)
def post_subscriber(body: SubscriberIn, request: Request):
    """201 `{id, created_at}` for a new contact; 200 with the existing entry's for a repeat."""
    classified = classify_contact(body.contact)
    if classified is None:
        raise api_error(422, "invalid_contact", "Enter an email address or a mobile number.")
    if not rate_limiter.allow(client_key(request)):
        raise api_error(429, "rate_limited", "Too many messages — please try again later.")
    contact, contact_type = classified
    entry = {
        "id": str(uuid.uuid4()),
        "created_at": utc_now(),
        "first_name": body.first_name,
        "contact": contact,
        "contact_type": contact_type,
    }
    changes = {"first_name": body.first_name} if body.first_name else {}
    stored, created = _store().upsert(lambda e: e.get("contact") == contact, entry, changes)
    return JSONResponse(
        content={"id": stored.get("id"), "created_at": stored.get("created_at")},
        status_code=201 if created else 200,
    )


@router.get("/api/subscribers", dependencies=[Depends(require_review_password)])
def list_subscribers():
    """Every sign-up, newest first."""
    items = _store().read_all()
    return JSONResponse(content={"total": len(items), "items": items}, headers=NO_STORE)


@router.delete("/api/subscribers/{entry_id}", status_code=204, dependencies=[Depends(require_review_password)])
def delete_subscriber(entry_id: str):
    if not _store().delete(entry_id):
        raise api_error(404, "not_found", "That entry no longer exists.")
    return Response(status_code=204)
