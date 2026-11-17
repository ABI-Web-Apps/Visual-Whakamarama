"""The demo reading, laid over a cohort's unread findings record.

The dataset delivers sub-1's findings unread: the marked areas and their kinetics, nothing a
reader decides. For the demo the report should read as a full report, wherever the app runs
(Nectar's MinIO holds the dataset as delivered), so the reading ships with the backend in
`demo_readings.json` and is applied here, at report time, instead of being uploaded over the
dataset. How each value was measured or chosen: resource-backend/demo/README.md. Every report
says "Demo data — not a clinical reading" under its masthead (template.DEMO_NOTICE).

It fills a record only when all of these hold:

- the reading exists for that cohort;
- the record's findings are the reading's own (same ids, labels and mask channels), so a
  different dataset that happens to call a patient sub-1 is left alone;
- nobody has read the record yet (`_unread`): a reading someone made is never replaced.

Only what a reader decides is taken from the demo: breast tissue, each finding's location,
assessment and ACR descriptors, the case's ACR sections and the exam assessment. The mask
anchors, kinetics and sizes stay the dataset's.

`DEMO_READINGS=0` in the environment turns it off. Remove this module, `demo_readings.json` and
DEMO_NOTICE once real readings are delivered as the report's input.
"""

import functools
import json
import os
from pathlib import Path

from app.reports import schema

READINGS = Path(__file__).with_name("demo_readings.json")

#: Printed as the report's reader whenever the demo reading filled it.
DEMO_READER = "Demo reading (not a clinician)"


def enabled() -> bool:
    return os.environ.get("DEMO_READINGS", "1") != "0"


@functools.cache
def _readings() -> dict[str, schema.Findings]:
    raw = json.loads(READINGS.read_text(encoding="utf-8"))
    return {cohort: schema.Findings.model_validate(record) for cohort, record in raw.items()}


def _identity(record: schema.Findings) -> list[tuple[str, str, int]]:
    return [(f.id, f.label, f.lesion.channel) for f in record.findings]


def _unread(record: schema.Findings) -> bool:
    return (
        record.breast_tissue == schema.BreastTissue()
        and record.assessment.category is None
        and not record.acr_case
        and all(
            f.location == schema.Location() and f.assessment is None and not f.acr_lesion
            for f in record.findings
        )
    )


def with_demo_reading(cohort: str, findings: schema.Findings) -> tuple[schema.Findings, bool]:
    """`findings` with the demo reading laid over it, and whether it was. Never modifies its input."""
    demo = _readings().get(cohort) if enabled() else None
    if demo is None or _identity(demo) != _identity(findings) or not _unread(findings):
        return findings, False

    record = findings.model_copy(deep=True)
    record.breast_tissue = demo.breast_tissue.model_copy(deep=True)
    record.assessment = demo.assessment.model_copy(deep=True)
    record.acr_case = dict(demo.acr_case)
    by_id = {f.id: f for f in demo.findings}
    for finding in record.findings:
        reading = by_id[finding.id]
        finding.location = reading.location.model_copy(deep=True)
        finding.assessment = reading.assessment
        finding.acr_lesion = dict(reading.acr_lesion)
    return record, True
