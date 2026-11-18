"""/api/subscribers: Stay in touch sign-ups, listed and deleted behind the review password.

Fixtures `feedback_dir`, `sleeps` and `api` are in conftest.py.
"""

import json
import re
import uuid
from datetime import datetime, timezone

import pytest

from app.router.subscribers import classify_contact

pytestmark = pytest.mark.usefixtures("feedback_dir")

URL = "/api/subscribers"
PASSWORD = {"X-Feedback-Password": "qwerty"}
ENTRY_KEYS = {"id", "created_at", "first_name", "contact", "contact_type"}
CREATED_AT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
INVALID = {"detail": {"code": "invalid_contact", "summary": "Enter an email address or a mobile number."}}
#: The whole answer to every accepted sign-up, new or repeat.
OK = {"ok": True}


def _entries(folder) -> list[dict]:
    raw = (folder / "subscribers.jsonl").read_bytes()
    return [json.loads(line) for line in raw.split(b"\n") if line]


@pytest.mark.parametrize(
    "raw, contact, kind",
    [
        (" Kia@Ora.NZ ", "kia@ora.nz", "email"),
        ("mere.smith+news@auckland.ac.nz", "mere.smith+news@auckland.ac.nz", "email"),
        ("021 123 4567", "0211234567", "phone"),
        ("+64 (21) 123-4567", "+64211234567", "phone"),
        ("09.373.7599", "093737599", "phone"),
        ("1234567", "1234567", "phone"),
        ("+123456789012345", "+123456789012345", "phone"),
    ],
)
def test_contact_is_normalised(api, feedback_dir, raw, contact, kind):
    response = api.post(URL, json={"first_name": "Mere", "contact": raw})
    assert response.status_code == 201
    [entry] = _entries(feedback_dir)
    assert entry["contact"] == contact and entry["contact_type"] == kind
    assert classify_contact(raw) == (contact, kind)


@pytest.mark.parametrize(
    "raw",
    [
        "hello",
        "123",
        "",
        "   ",
        "a@b",
        "a@b.",
        "a@.nz",
        "a b@c.nz",
        "a@b@c.nz",
        "123456",
        "1234567890123456",
        "021+1234567",
        "++64211234567",
        "021 123 4567 ext 2",
        "٠٢١١٢٣٤٥٦٧",
        "x" * 250 + "@a.nz",
    ],
)
def test_invalid_contact_is_422(api, feedback_dir, raw):
    response = api.post(URL, json={"contact": raw})
    assert response.status_code == 422
    assert response.json() == INVALID
    assert not (feedback_dir / "subscribers.jsonl").exists()


def test_a_new_contact_is_201_ok_and_stored_with_uuid_and_utc_time(api, feedback_dir):
    response = api.post(URL, json={"first_name": "Mere", "contact": "kia@ora.nz"})
    assert response.status_code == 201
    assert response.json() == OK
    [entry] = _entries(feedback_dir)
    assert uuid.UUID(entry["id"]).version == 4
    assert CREATED_AT.match(entry["created_at"])
    created = datetime.strptime(entry["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
    assert abs((datetime.now(timezone.utc) - created).total_seconds()) < 5
    assert entry["first_name"] == "Mere"


def test_first_name_is_optional_trimmed_and_at_most_60(api, feedback_dir):
    assert api.post(URL, json={"contact": "a@b.nz"}).status_code == 201
    assert api.post(URL, json={"first_name": "  Hēmi ", "contact": "c@d.nz"}).status_code == 201
    assert api.post(URL, json={"first_name": "x" * 60, "contact": "e@f.nz"}).status_code == 201
    assert api.post(URL, json={"first_name": "x" * 61, "contact": "g@h.nz"}).status_code == 422
    assert [e["first_name"] for e in _entries(feedback_dir)] == ["", "Hēmi", "x" * 60]
    assert "Hēmi".encode("utf-8") in (feedback_dir / "subscribers.jsonl").read_bytes()


def test_unknown_or_missing_fields_are_422(api, feedback_dir):
    assert api.post(URL, json={"contact": "a@b.nz", "email": "a@b.nz"}).status_code == 422
    assert api.post(URL, json={"first_name": "Mere"}).status_code == 422
    assert api.post(URL, json={"contact": 211234567}).status_code == 422
    assert not (feedback_dir / "subscribers.jsonl").exists()


def test_a_repeat_contact_answers_the_same_and_changes_nothing(api, feedback_dir):
    """The answer must not tell anyone whether a contact is already on the list, and a repeat
    must not let anyone rename someone else's entry."""
    for contact in ("a@b.nz", "Kia@Ora.nz", "e@f.nz"):
        assert api.post(URL, json={"first_name": "Mere", "contact": contact}).json() == OK
    raw = (feedback_dir / "subscribers.jsonl").read_bytes()

    for first_name in ("", "Mereana", "Someone else"):
        response = api.post(URL, json={"first_name": first_name, "contact": " KIA@ora.NZ"})
        assert response.status_code == 201
        assert response.json() == OK
    assert (feedback_dir / "subscribers.jsonl").read_bytes() == raw
    assert [e["first_name"] for e in _entries(feedback_dir)] == ["Mere", "Mere", "Mere"]


def test_repeat_phone_matches_however_it_is_spaced(api, feedback_dir):
    assert api.post(URL, json={"contact": "021 123 4567"}).status_code == 201
    raw = (feedback_dir / "subscribers.jsonl").read_bytes()
    again = api.post(URL, json={"first_name": "Hēmi", "contact": "021-123-4567"})
    assert again.status_code == 201 and again.json() == OK
    assert (feedback_dir / "subscribers.jsonl").read_bytes() == raw


def test_subscribers_are_kept_apart_from_feedback(api, feedback_dir):
    feedback = {"rating": 5, "comment": "", "page": "/", "device": "desktop", "app_version": "1", "mode": "standalone"}
    assert api.post("/api/feedback", json=feedback).status_code == 201
    feedback_bytes = (feedback_dir / "feedback.jsonl").read_bytes()

    assert api.post(URL, json={"contact": "kia@ora.nz"}).status_code == 201
    assert sorted(p.name for p in feedback_dir.iterdir()) == ["feedback.jsonl", "subscribers.jsonl"]
    assert (feedback_dir / "feedback.jsonl").read_bytes() == feedback_bytes
    assert api.get("/api/feedback", headers=PASSWORD).json()["total"] == 1
    assert api.get(URL, headers=PASSWORD).json()["total"] == 1


def test_list_needs_the_password(api, sleeps):
    api.post(URL, json={"contact": "kia@ora.nz"})
    for headers in ({}, {"X-Feedback-Password": "nope"}):
        response = api.get(URL, headers=headers)
        assert response.status_code == 401
        assert response.json() == {"detail": {"code": "bad_password", "summary": "Wrong password."}}
    assert sleeps == [0.4, 0.4]

    response = api.get(URL, headers=PASSWORD)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"


def test_list_is_newest_first(api, feedback_dir):
    assert api.get(URL, headers=PASSWORD).json() == {"total": 0, "items": []}
    for n in range(3):
        api.post(URL, json={"first_name": f"P{n}", "contact": f"p{n}@x.nz"})
    ids = [e["id"] for e in _entries(feedback_dir)]
    # A repeat sign-up does not move an entry, or rename it.
    api.post(URL, json={"first_name": "Again", "contact": "p0@x.nz"})
    body = api.get(URL, headers=PASSWORD).json()
    assert body["total"] == 3
    assert [item["id"] for item in body["items"]] == ids[::-1]
    assert body["items"][2]["first_name"] == "P0"
    assert all(set(item) == ENTRY_KEYS for item in body["items"])


def test_delete_removes_exactly_one_line_and_leaves_the_others_byte_identical(api, feedback_dir):
    for n in range(3):
        api.post(URL, json={"contact": f"p{n}@x.nz"})
    ids = [e["id"] for e in _entries(feedback_dir)]
    before = (feedback_dir / "subscribers.jsonl").read_bytes().split(b"\n")
    response = api.delete(f"{URL}/{ids[0]}", headers=PASSWORD)
    assert response.status_code == 204 and response.content == b""
    assert (feedback_dir / "subscribers.jsonl").read_bytes().split(b"\n") == before[1:]
    assert [item["id"] for item in api.get(URL, headers=PASSWORD).json()["items"]] == [ids[2], ids[1]]
    # Gone means gone: the same contact signs up afresh.
    assert api.post(URL, json={"contact": "p0@x.nz"}).status_code == 201
    assert [e["contact"] for e in _entries(feedback_dir)] == ["p1@x.nz", "p2@x.nz", "p0@x.nz"]
    assert ids[0] not in {e["id"] for e in _entries(feedback_dir)}


def test_delete_unknown_is_404(api, feedback_dir):
    api.post(URL, json={"contact": "kia@ora.nz"})
    response = api.delete(f"{URL}/no-such-id", headers=PASSWORD)
    assert response.status_code == 404
    assert response.json() == {"detail": {"code": "not_found", "summary": "That entry no longer exists."}}
    assert len(_entries(feedback_dir)) == 1


def test_delete_a_feedback_id_here_is_404(api, feedback_dir):
    feedback = {"rating": 5, "comment": "", "page": "/", "device": "desktop", "app_version": "1", "mode": "standalone"}
    feedback_id = api.post("/api/feedback", json=feedback).json()["id"]
    assert api.delete(f"{URL}/{feedback_id}", headers=PASSWORD).status_code == 404
    assert api.get("/api/feedback", headers=PASSWORD).json()["total"] == 1


def test_delete_with_a_wrong_password_is_401_and_removes_nothing(api, feedback_dir, sleeps):
    api.post(URL, json={"contact": "kia@ora.nz"})
    [entry] = [e["id"] for e in _entries(feedback_dir)]
    raw = (feedback_dir / "subscribers.jsonl").read_bytes()
    response = api.delete(f"{URL}/{entry}", headers={"X-Feedback-Password": "nope"})
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "bad_password"
    assert sleeps == [0.4]
    assert (feedback_dir / "subscribers.jsonl").read_bytes() == raw


def test_entry_has_no_client_details(api, feedback_dir):
    headers = {"X-Forwarded-For": "203.0.113.99", "User-Agent": "Mozilla/5.0 (iPhone) Distinctive/9.9"}
    api.post(URL, json={"first_name": "Mere", "contact": "kia@ora.nz"}, headers=headers)
    raw = (feedback_dir / "subscribers.jsonl").read_text(encoding="utf-8")
    [entry] = _entries(feedback_dir)
    assert set(entry) == ENTRY_KEYS
    assert "203.0.113.99" not in raw and "Distinctive" not in raw and "testclient" not in raw


def test_rate_limit_429_after_10(api, feedback_dir):
    headers = {"X-Forwarded-For": "203.0.113.7"}
    for n in range(10):
        assert api.post(URL, json={"contact": f"p{n}@x.nz"}, headers=headers).status_code == 201
    response = api.post(URL, json={"contact": "p10@x.nz"}, headers=headers)
    assert response.status_code == 429
    assert response.json()["detail"]["code"] == "rate_limited"
    # Repeats count too: the limit is on posts, not on new contacts.
    assert api.post(URL, json={"contact": "p0@x.nz"}, headers=headers).status_code == 429
    assert api.post(URL, json={"contact": "p10@x.nz"}, headers={"X-Forwarded-For": "198.51.100.4"}).status_code == 201
    assert len(_entries(feedback_dir)) == 11


def test_an_invalid_contact_does_not_use_up_the_limit(api):
    headers = {"X-Forwarded-For": "203.0.113.8"}
    for _ in range(12):
        assert api.post(URL, json={"contact": "hello"}, headers=headers).status_code == 422
    assert api.post(URL, json={"contact": "kia@ora.nz"}, headers=headers).status_code == 201


def test_feedback_and_sign_ups_have_separate_limits(api):
    headers = {"X-Forwarded-For": "203.0.113.9"}
    for n in range(10):
        api.post(URL, json={"contact": f"p{n}@x.nz"}, headers=headers)
    feedback = {"rating": 5, "comment": "", "page": "/", "device": "desktop", "app_version": "1", "mode": "standalone"}
    assert api.post("/api/feedback", json=feedback, headers=headers).status_code == 201
