"""The demo reading the backend lays over sub-1's unread findings (app/reports/demo_reading.py).

It ships with the backend, so the report is filled wherever the app runs (Nectar's MinIO holds
the dataset's original, unread record). It fills only an UNREAD record whose findings are the
demo's own, keeps the dataset's anchors and kinetics, and never replaces a reading someone made.
"""

from pathlib import Path

import pytest

from app.reports import schema
from app.reports.demo_reading import DEMO_READER, with_demo_reading
from app.reports.template import EM_DASH, build_context
from app.services.report import prepare_report

ORIGINAL = Path(__file__).resolve().parents[1] / "demo" / "sub-1" / "findings_json.original.json"


@pytest.fixture(autouse=True)
def _demo_readings_on(monkeypatch):
    monkeypatch.setenv("DEMO_READINGS", "1")


@pytest.fixture()
def unread():
    return schema.loads(ORIGINAL.read_text(encoding="utf-8"))


def test_fills_sub_1s_unread_record(unread):
    filled, applied = with_demo_reading("sub-1", unread)
    assert applied
    assert filled.breast_tissue.fgt == "scattered"
    assert [f.assessment for f in filled.findings] == [4, 3]
    assert all(f.location.laterality == "right" for f in filled.findings)
    assert unread.breast_tissue.fgt is None  # the input is not modified


def test_keeps_the_datasets_own_anchors_and_kinetics(unread):
    unread.findings[0].lesion.layer_id = "layer1"  # another copy of the dataset anchors differently
    filled, _ = with_demo_reading("sub-1", unread)
    for mine, theirs in zip(filled.findings, unread.findings):
        assert mine.lesion == theirs.lesion
        assert mine.kinetics == theirs.kinetics


def test_leaves_another_cohort_alone(unread):
    filled, applied = with_demo_reading("sub-2", unread)
    assert not applied
    assert filled == unread


def test_leaves_a_record_with_other_findings_alone(unread):
    unread.findings[1].lesion.channel = 7
    filled, applied = with_demo_reading("sub-1", unread)
    assert not applied
    assert filled == unread


def test_never_replaces_a_reading_someone_made(unread):
    unread.findings[0].assessment = 2
    filled, applied = with_demo_reading("sub-1", unread)
    assert not applied
    assert filled == unread


def test_can_be_switched_off(unread, monkeypatch):
    monkeypatch.setenv("DEMO_READINGS", "0")
    assert with_demo_reading("sub-1", unread) == (unread, False)


def test_the_report_names_the_demo_as_its_reader_and_the_assay(unread):
    case = prepare_report("sub-1", unread, None, None, assay_uuid="assay-001").case
    assert case.user_uuid == DEMO_READER
    assert case.assay_uuid == "assay-001"


def test_the_filled_report_leaves_nothing_unrecorded(unread):
    # The route's path: the unread record goes in, prepare_report lays the reading over it.
    parts = prepare_report("sub-1", unread, None, None, assay_uuid="assay-001")
    context = build_context(parts.case, parts.findings)
    assert context["assessment"]["assessed"]
    assert all(row["assessed"] for row in context["breast_tissue"]["rows"])
    assert all(cell["value"] != EM_DASH for cell in context["meta"])
    sections = context["acr"]["case"] + [s for rows in context["acr"]["lesions"].values() for s in rows]
    unrecorded = [(s["title"], r["label"]) for s in sections for r in s["rows"] if r["text"] == EM_DASH]
    assert unrecorded == []
    for finding in context["findings"]:
        assert all(row["assessed"] for row in finding["location_rows"]), finding["label"]
        assert all(row["assessed"] for row in finding["distance_rows"]), finding["label"]
