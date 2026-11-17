# Demo reading for sub-1

The report PDF prints the dataset's `findings_json`. The one delivered with sub-1 records only
the two marked areas and their kinetics, so most of the report was dashes. For the demo, the
backend lays a filled reading over it at report time (`app/reports/demo_reading.py`), so the
report is filled wherever the app runs, with nothing to upload. **No clinician wrote this
reading**: every report says so under its masthead ("Demo data — not a clinical reading") and
names "Demo reading (not a clinician)" as its reader.

It fills sub-1 only while its record is unread and has the reading's own findings (same ids,
labels and mask channels); a reading someone made is never replaced. `DEMO_READINGS=0` in the
backend's environment turns it off. When real readings are delivered as the report's input,
delete `app/reports/demo_reading.py`, `app/reports/demo_readings.json`, this folder and the
demo line.

| File | What it is |
|---|---|
| `../app/reports/demo_readings.json` | The demo reading, keyed by cohort; ships with the backend |
| `sub-1/findings_json.original.json` | sub-1's record as the dataset delivers it, byte for byte |
| `measure_sub1.py` | The one-off script behind the measured values (run it to see them) |

## Where each value came from

**Kept from the original, unchanged:** both findings' ids, labels, mask anchors (layer, channel,
colour), kinetics curves and phases, provenance.

**Measured from the images** (`measure_sub1.py`, on registration_1 and the researcher_manual
mask, in patient LPS; `source: "computed"`):

| | Finding 1 | Finding 2 |
|---|---|---|
| Laterality | right | right |
| Location | central (behind the nipple, middle third) | 1 o'clock |
| Depth | middle | posterior |
| Distance to skin | 2.3 cm | 4.1 cm |
| Distance to nipple | 2.8 cm | 6.4 cm |

The nipple is the right breast's most anterior skin point (the patient lies prone). Depth uses
the chest wall below. Behind the nipple, the anterior third is retroareolar and deeper is
central, as BI-RADS uses the terms.

**Read by eye** (`source: "manual"`): distance to the chest wall, 3.7 cm and 1.4 cm, from the
lesion's most posterior voxel to where the pectoralis begins behind it on the axial slice
through its centroid (`CHEST_WALL_Y_MM` in the script).

**Sizes** are not in the record: the backend computes them from the mask, as before.

**Chosen for the demo**, to be consistent with what the slices show, but not a reading:

- Breast tissue: scattered fibroglandular tissue; minimal, symmetric background enhancement.
- Finding 1: irregular mass, indistinct margin, heterogeneous enhancement, BI-RADS 4.
- Finding 2: oval mass, circumscribed margin, homogeneous enhancement, BI-RADS 3.
- T2 signal (finding 1 not hyperintense, finding 2 hyperintense): this dataset's
  `t2_nrrd` is an exact copy of the pre-contrast series, so nothing can be read from it.
- Lymph nodes: normal. Exam category: derived from the findings (4).
- Associated features (each finding) and other, typically benign findings: all recorded as
  absent (`false`), which the report prints as "No". Sections that do not apply are recorded
  as such and print one line: no implants or other augmentation, no non-mass enhancement on
  either finding. Other anatomic location: none.
