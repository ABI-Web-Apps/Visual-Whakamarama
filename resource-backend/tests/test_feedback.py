"""POST /api/feedback and GET /api/feedback: anonymous feedback, listed behind a password."""

import json
import logging
import re
import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.router import feedback
from app.services.feedback_store import FeedbackStore, RateLimiter
from app.utils.setup import Config

URL = "/api/feedback"
CREATED_AT = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
ENTRY_KEYS = {"id", "created_at", "rating", "comment", "page", "device", "app_version", "mode"}


def _body(**changes) -> dict:
    body = {
        "rating": 4,
        "comment": "Clear, thank you.",
        "page": "/my-report",
        "device": "phone",
        "app_version": "1.4.0",
        "mode": "standalone",
    }
    body.update(changes)
    return body


@pytest.fixture(autouse=True)
def feedback_dir(tmp_path, monkeypatch):
    """Feedback written to a fresh temp folder; the rate limiter starts empty; no real delay."""
    folder = tmp_path / "feedback"
    monkeypatch.setattr(Config, "FEEDBACK_DIR", folder)
    monkeypatch.setattr(Config, "FEEDBACK_ADMIN_PASSWORD", "qwerty")
    feedback.rate_limiter.clear()
    yield folder
    feedback.rate_limiter.clear()


@pytest.fixture()
def sleeps(monkeypatch) -> list:
    """Records the delay a wrong password costs instead of waiting it out."""
    calls = []
    monkeypatch.setattr(feedback.time, "sleep", calls.append)
    return calls


@pytest.fixture()
def api():
    return TestClient(app)


def _lines(folder) -> list[str]:
    return (folder / "feedback.jsonl").read_text(encoding="utf-8").splitlines()


def test_post_returns_uuid_and_utc_time(api):
    response = api.post(URL, json=_body())
    assert response.status_code == 201
    body = response.json()
    assert set(body) == {"id", "created_at"}
    assert uuid.UUID(body["id"]).version == 4
    assert CREATED_AT.match(body["created_at"])
    created = datetime.strptime(body["created_at"], "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
    assert abs((datetime.now(timezone.utc) - created).total_seconds()) < 5


def test_post_appends_one_json_line(api, feedback_dir):
    response = api.post(URL, json=_body(comment="Kia ora, ngā mihi"))
    assert response.status_code == 201
    raw = (feedback_dir / "feedback.jsonl").read_bytes()
    assert raw.endswith(b"\n") and raw.count(b"\n") == 1
    assert "ngā mihi".encode("utf-8") in raw
    entry = json.loads(raw)
    assert entry == {**_body(comment="Kia ora, ngā mihi"), **response.json()}


def test_rating_only_and_comment_only_are_accepted(api, feedback_dir):
    assert api.post(URL, json=_body(comment="")).status_code == 201
    assert api.post(URL, json=_body(rating=None)).status_code == 201
    omitted = _body()
    del omitted["comment"]
    assert api.post(URL, json=omitted).status_code == 201
    assert len(_lines(feedback_dir)) == 3


def test_empty_feedback_is_422(api, feedback_dir):
    assert api.post(URL, json=_body(rating=None, comment="  ")).status_code == 422
    assert api.post(URL, json=_body(rating=None, comment="\n\t")).status_code == 422
    assert not (feedback_dir / "feedback.jsonl").exists()


@pytest.mark.parametrize(
    "changes",
    [
        {"rating": 6},
        {"rating": 0},
        {"rating": "3"},
        {"rating": 2.5},
        {"rating": True},
        {"comment": "x" * 1001},
        {"page": "/" + "p" * 200},
        {"app_version": "1" * 33},
        {"device": "watch"},
        {"mode": "embedded"},
    ],
)
def test_out_of_range_rating_and_long_comment_are_422(api, feedback_dir, changes):
    assert api.post(URL, json=_body(**changes)).status_code == 422
    assert not (feedback_dir / "feedback.jsonl").exists()


def test_the_longest_values_are_accepted(api):
    body = _body(comment="x" * 1000, page="/" + "p" * 199, app_version="1" * 32)
    assert api.post(URL, json=body).status_code == 201


def test_unknown_fields_are_422(api, feedback_dir):
    assert api.post(URL, json=_body(email="someone@example.com")).status_code == 422
    assert api.post(URL, json=_body(id="chosen-by-the-client")).status_code == 422
    assert not (feedback_dir / "feedback.jsonl").exists()


def test_missing_context_fields_are_422(api):
    for field in ("page", "device", "app_version", "mode"):
        body = _body()
        del body[field]
        assert api.post(URL, json=body).status_code == 422, field


def test_comment_is_stored_stripped(api, feedback_dir):
    api.post(URL, json=_body(comment="  Bigger text, please.\n"))
    assert json.loads(_lines(feedback_dir)[0])["comment"] == "Bigger text, please."


def test_get_needs_the_password(api, sleeps):
    api.post(URL, json=_body())
    for headers in ({}, {"X-Feedback-Password": "nope"}, {"X-Feedback-Password": ""}, {"X-Feedback-Password": "QWERTY"}):
        response = api.get(URL, headers=headers)
        assert response.status_code == 401, headers
        assert response.json() == {"detail": {"code": "bad_password", "summary": "Wrong password."}}
    assert sleeps == [0.4] * 4

    response = api.get(URL, headers={"X-Feedback-Password": "qwerty"})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["total"] == 1
    assert len(sleeps) == 4


def test_get_with_no_feedback_yet(api):
    response = api.get(URL, headers={"X-Feedback-Password": "qwerty"})
    assert response.status_code == 200
    assert response.json() == {"total": 0, "items": []}


def test_get_is_newest_first(api):
    ids = [api.post(URL, json=_body(comment=f"note {n}")).json()["id"] for n in range(3)]
    body = api.get(URL, headers={"X-Feedback-Password": "qwerty"}).json()
    assert body["total"] == 3
    assert [item["id"] for item in body["items"]] == ids[::-1]
    assert [item["comment"] for item in body["items"]] == ["note 2", "note 1", "note 0"]
    assert all(set(item) == ENTRY_KEYS for item in body["items"])


def test_bad_line_is_skipped(api, feedback_dir, caplog):
    first = api.post(URL, json=_body(comment="first")).json()["id"]
    with (feedback_dir / "feedback.jsonl").open("ab") as handle:
        handle.write(b"{not json\n")
        handle.write(b"\xff\xfe broken bytes\n")
        handle.write(b"[1, 2, 3]\n")
        handle.write(b"\n")
    last = api.post(URL, json=_body(comment="last")).json()["id"]

    with caplog.at_level(logging.WARNING):
        body = api.get(URL, headers={"X-Feedback-Password": "qwerty"}).json()
    assert body["total"] == 2
    assert [item["id"] for item in body["items"]] == [last, first]
    skipped = [r for r in caplog.records if "skipped" in r.getMessage()]
    assert len(skipped) == 3


def test_line_separators_in_a_comment_stay_on_one_line(api, feedback_dir):
    comment = "one two three\u0085four"
    api.post(URL, json=_body(comment=comment))
    api.post(URL, json=_body(comment="after"))
    assert (feedback_dir / "feedback.jsonl").read_bytes().count(b"\n") == 2
    items = api.get(URL, headers={"X-Feedback-Password": "qwerty"}).json()["items"]
    assert [item["comment"] for item in items] == ["after", comment]


def test_rate_limit_429_after_20(api, feedback_dir):
    headers = {"X-Forwarded-For": "203.0.113.7, 10.0.0.2"}
    for _ in range(20):
        assert api.post(URL, json=_body(), headers=headers).status_code == 201
    response = api.post(URL, json=_body(), headers=headers)
    assert response.status_code == 429
    assert response.json() == {
        "detail": {"code": "rate_limited", "summary": "Too many messages — please try again later."}
    }
    # The first hop is the client; the proxy after it is not.
    assert api.post(URL, json=_body(), headers={"X-Forwarded-For": "203.0.113.7"}).status_code == 429
    assert api.post(URL, json=_body(), headers={"X-Forwarded-For": "198.51.100.4, 10.0.0.2"}).status_code == 201
    # Without the header, the connection's own address is the key.
    assert api.post(URL, json=_body()).status_code == 201
    assert len(_lines(feedback_dir)) == 22


def test_password_from_env(api, monkeypatch, sleeps):
    monkeypatch.setattr(Config, "FEEDBACK_ADMIN_PASSWORD", "s3cret")
    assert api.get(URL, headers={"X-Feedback-Password": "qwerty"}).status_code == 401
    assert api.get(URL, headers={"X-Feedback-Password": "s3cret"}).status_code == 200


def test_an_empty_configured_password_unlocks_nothing(api, monkeypatch, sleeps):
    monkeypatch.setattr(Config, "FEEDBACK_ADMIN_PASSWORD", "")
    assert api.get(URL, headers={"X-Feedback-Password": ""}).status_code == 401
    assert api.get(URL).status_code == 401


def test_entry_has_no_client_details(api, feedback_dir):
    headers = {"X-Forwarded-For": "203.0.113.99", "User-Agent": "Mozilla/5.0 (iPhone) Distinctive/9.9"}
    api.post(URL, json=_body(), headers=headers)
    [line] = _lines(feedback_dir)
    assert set(json.loads(line)) == ENTRY_KEYS
    assert "203.0.113.99" not in line and "Distinctive" not in line and "testclient" not in line


def test_store_creates_its_folder_and_reads_an_absent_file_as_empty(tmp_path):
    store = FeedbackStore(tmp_path / "a" / "b" / "feedback.jsonl")
    assert store.read_all() == []
    store.append({"id": "1", "comment": "ā"})
    store.append({"id": "2"})
    assert [e["id"] for e in store.read_all()] == ["2", "1"]
    assert "ā" in (tmp_path / "a" / "b" / "feedback.jsonl").read_text(encoding="utf-8")


def test_rate_limiter_window_slides():
    now = [1000.0]
    limiter = RateLimiter(limit=2, window_s=10, clock=lambda: now[0])
    assert limiter.allow("a") and limiter.allow("a")
    assert not limiter.allow("a")
    assert limiter.allow("b")
    now[0] += 5
    assert not limiter.allow("a")  # a refused attempt is not recorded...
    now[0] += 5.01
    assert limiter.allow("a")  # ...so both earlier posts have aged out by now
    assert limiter.allow("a")
    assert not limiter.allow("a")


def test_rate_limiter_forgets_idle_addresses():
    now = [0.0]
    limiter = RateLimiter(limit=1, window_s=10, clock=lambda: now[0])
    for n in range(50):
        limiter.allow(f"10.0.0.{n}")
    now[0] += 11
    limiter.allow("10.0.1.1")
    assert limiter.tracked() <= 1
