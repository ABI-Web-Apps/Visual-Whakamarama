# Demo reading for sub-1

The report PDF prints whatever the dataset's `findings_json` holds. The one delivered with
sub-1 records only the two marked areas and their kinetics, so most of the report was dashes.
For the demo, `sub-1/findings_json.json` fills it in. **No clinician wrote this reading**, and
every report says so under its masthead ("Demo data — not a clinical reading",
`app/reports/template.py`). When real readings are delivered as the report's input, drop this
folder and that line.

| File | What it is |
|---|---|
| `sub-1/findings_json.json` | The demo reading, uploaded over the dataset's findings |
| `sub-1/findings_json.original.json` | The record as it was in MinIO before the upload, byte for byte |
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
  absent (`false`). The ACR form prints an unticked box as a dash, so on the PDF these rows
  still read "—"; the record says they were looked at.

## Uploading it

The record replaces `measurements/workdir/primary/sub-1/sam-15/findings_json.json` in the MinIO
the backend reads. Upload `sub-1/findings_json.json` there (the MinIO console, `mc cp`, or the
`minio` Python client); upload `findings_json.original.json` to the same key to undo it. The
backend renders the report again on the next request, because the object's identity changed.
