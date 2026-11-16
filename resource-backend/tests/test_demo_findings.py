"""The demo reading for sub-1 (`demo/sub-1/findings_json.json`).

The record is uploaded over the dataset's findings so the report has something to say for the
demo. It must load as a real findings record, fill what the report prints, use only values the
ACR form offers, and keep the original's findings exactly: the mask channels, colours and the
computed kinetics are the dataset's, not the demo's.
"""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

from app.reports import lexicon, schema
from app.reports.acr_form import ACR_SECTIONS

DEMO = Path(__file__).resolve().parents[1] / "demo" / "sub-1"


@pytest.fixture(scope="module")
def demo():
    return schema.loads((DEMO / "findings_json.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def original():
    return schema.loads((DEMO / "findings_json.original.json").read_text(encoding="utf-8"))


def _free_fields(scope):
    """The form's own fields (not bound to a schema attribute) for one scope, by id."""
    return {
        field.id: field
        for section in ACR_SECTIONS
        if section.scope == scope
        for field in section.fields
        if field.bind is None
    }


def _assert_form_values(values, scope):
    fields = _free_fields(scope)
    for key, value in values.items():
        assert key in fields, f"{key} is not a {scope} field of the ACR form"
        field = fields[key]
        if field.kind == "select":
            assert value in {o.value for o in field.options}, f"{key}={value!r} is not an option"
        elif field.kind == "check":
            assert isinstance(value, bool), f"{key} must be true or false"
        else:
            assert isinstance(value, str), f"{key} must be text"


def test_breast_tissue_is_filled(demo):
    tissue = demo.breast_tissue
    assert tissue.fgt and tissue.bpe_level and tissue.bpe_symmetry


def test_every_finding_has_a_location_and_an_assessment(demo):
    assert demo.findings
    for finding in demo.findings:
        loc = finding.location
        assert loc.laterality and loc.depth, finding.id
        # The schema takes a clock position or a quadrant, never both.
        assert (loc.clock_position is None) != (loc.quadrant is None), finding.id
        assert loc.distance_nipple_cm and loc.distance_skin_cm and loc.distance_ribcage_cm, finding.id
        assert finding.assessment is not None, finding.id
        assert finding.acr_lesion, finding.id


def test_descriptors_are_values_the_form_offers(demo):
    for finding in demo.findings:
        _assert_form_values(finding.acr_lesion, "lesion")
    _assert_form_values(demo.acr_case, "case")


def test_the_exam_category_resolves(demo):
    assert lexicon.resolve_exam_category(demo.assessment, demo.findings) is not None


def test_the_findings_are_the_originals(demo, original):
    def identity(record):
        return [
            (f.id, f.label, f.lesion.model_dump(), f.kinetics.model_dump())
            for f in record.findings
        ]

    assert identity(demo) == identity(original)


#: The ETag MinIO reported for the object when it was backed up: for a single-part upload, the
#: MD5 of its bytes. Restoring the dataset means uploading this file back unchanged.
ORIGINAL_ETAG = "fa99dec1bbab46c449a2e601eb5918be"


def test_the_original_is_kept_byte_for_byte_as_found():
    raw = (DEMO / "findings_json.original.json").read_bytes()
    assert hashlib.md5(raw).hexdigest() == ORIGINAL_ETAG


def test_retroareolar_is_only_used_in_the_anterior_third(demo):
    # BI-RADS: behind the nipple in the anterior third is retroareolar; deeper is central.
    for finding in demo.findings:
        if finding.location.quadrant == "retroareolar":
            assert finding.location.depth == "anterior", finding.id


def _check_fields(section_id):
    return [f.id for s in ACR_SECTIONS if s.id == section_id for f in s.fields if f.kind == "check"]


def test_absent_features_are_recorded_as_absent(demo):
    # A reading that looked and found nothing says so; it does not leave the boxes unread.
    for finding in demo.findings:
        for field_id in _check_fields("associated"):
            assert isinstance(finding.acr_lesion.get(field_id), bool), (finding.id, field_id)
    for field_id in _check_fields("other_benign"):
        assert isinstance(demo.acr_case.get(field_id), bool), field_id


def _measure_module():
    spec = importlib.util.spec_from_file_location("measure_sub1", DEMO.parent / "measure_sub1.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(("depth", "expected"), [("anterior", "retroareolar"), ("middle", "central"), ("posterior", "central")])
def test_behind_the_nipple_is_retroareolar_only_in_the_anterior_third(depth, expected):
    assert _measure_module().quadrant(1.0, 2.0, "right", depth) == expected


def test_off_the_nipple_the_quadrant_ignores_depth():
    measure = _measure_module()
    # 17 mm medial and 19 mm superior of a right nipple: upper inner, at any depth.
    assert {measure.quadrant(16.9, 19.0, "right", d) for d in ("anterior", "middle", "posterior")} == {"UIQ"}
