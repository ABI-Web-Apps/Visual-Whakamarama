"""Measure sub-1's lesion locations for the demo reading. Run once; prints JSON.

    cd resource-backend
    .venv/Scripts/python.exe demo/measure_sub1.py            # Windows
    .venv/bin/python demo/measure_sub1.py                    # elsewhere

Reads the registration_1 volume and the researcher_manual mask of sub-1 from the MinIO at
MINIO_ENDPOINT (default localhost:9000, bucket `measurements`, dataset `workdir`) through the
backend's own reader, so the voxels are in canonical LPS: i -> patient's left, j -> posterior,
k -> superior, with the grid's spacing in mm. Every distance below is in that frame.

What is measured and how (demo/README.md lists which value came from where):

- body: voxels above BODY_FRACTION of the 99th percentile (air in front of the breasts stays
  below it: its 99.9th percentile is about 89 against a cut of about 82, and the opening
  removes that speckle), opened, largest connected component, holes filled per axial slice;
- laterality: the lesion centroid's side of the body's mid-x on its axial slice;
- nipple: the most anterior body voxel on that side, over the whole volume (the patient lies
  prone, so the breasts hang anteriorly and the nipple is the breast's anterior tip);
- distance to skin: the smallest distance from a lesion voxel to air (an exact Euclidean
  distance transform of the body, in mm);
- distance to nipple: the smallest distance from a lesion voxel to the nipple point;
- clock: as the examiner faces the patient, 12 is superior and 3 is the examiner's right
  (the patient's left), from the nipple to the lesion centroid in the coronal plane;
- quadrant: within RETROAREOLAR_MM of the nipple in the coronal plane, retroareolar in the
  anterior third and central deeper (the BI-RADS usage), else upper/lower and outer
  (lateral) / inner (medial). Both are printed; the findings schema
  takes only one, so the record keeps the quadrant for a lesion behind the nipple (a clock
  face has no hour for one) and the clock position otherwise;
- chest wall: NOT computed. CHEST_WALL_Y_MM is where the pectoralis begins behind each lesion,
  read by eye on the axial slice through its centroid (y counted from the image's anterior
  edge, as the grid on those slices showed). The distance runs from the lesion's most posterior
  voxel to that line; depth is the third of the nipple-to-chest-wall span the centroid is in.
"""

import json
import math
import os
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.volume_reader import read_canonical  # noqa: E402

DATASET = "workdir/primary/sub-1/"
MRI = "sam-7/registration_1_nrrd.nrrd"
MASK = "sam-13/researcher_manual_LPS_nii.nii.gz"

BODY_FRACTION = 0.10
RETROAREOLAR_MM = 10.0
#: Read by eye; see the module docstring. Keyed by mask channel.
CHEST_WALL_Y_MM = {1: 163.0, 2: 153.0}


def fetch(name):
    from minio import Minio

    client = Minio(
        os.environ.get("MINIO_ENDPOINT", "localhost:9000"),
        access_key=os.environ.get("MINIO_ACCESS_KEY", "minioadmin"),
        secret_key=os.environ.get("MINIO_SECRET_KEY", "minioadmin"),
        secure=False,
    )
    response = client.get_object("measurements", DATASET + name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def body_mask(volume):
    body = volume > BODY_FRACTION * np.percentile(volume, 99)
    body = ndimage.binary_opening(body, iterations=1)
    labels, count = ndimage.label(body)
    sizes = ndimage.sum(body, labels, range(1, count + 1))
    body = labels == (int(np.argmax(sizes)) + 1)
    for k in range(body.shape[2]):
        body[:, :, k] = ndimage.binary_fill_holes(body[:, :, k])
    return body


def clock_position(dx, dz):
    """dx: towards the patient's left (the examiner's right); dz: superior. Both in mm."""
    hour = round(math.degrees(math.atan2(dx, dz)) / 30) % 12
    return 12 if hour == 0 else hour


def quadrant(dx, dz, laterality, depth):
    if math.hypot(dx, dz) < RETROAREOLAR_MM:
        return "retroareolar" if depth == "anterior" else "central"
    upper = dz > 0
    outer = dx < 0 if laterality == "right" else dx > 0
    return ("U" if upper else "L") + ("O" if outer else "I") + "Q"


def depth(centroid_y, nipple_y, chest_wall_y):
    third = (centroid_y - nipple_y) / (chest_wall_y - nipple_y)
    return "anterior" if third < 1 / 3 else "middle" if third < 2 / 3 else "posterior"


def measure():
    volume, geometry = read_canonical(fetch(MRI), MRI.split("/")[-1])
    mask, _ = read_canonical(fetch(MASK), MASK.split("/")[-1])
    spacing = np.asarray(geometry.spacing, dtype=float)
    body = body_mask(volume)
    to_skin = ndimage.distance_transform_edt(body, sampling=spacing)

    out = {}
    for channel in sorted(int(c) for c in np.unique(mask) if c > 0):
        voxels = np.argwhere(mask == channel)
        mm = voxels * spacing
        centroid = voxels.mean(axis=0)
        c_mm = centroid * spacing
        k = int(round(centroid[2]))

        on_slice = np.argwhere(body[:, :, k])
        mid_i = (on_slice[:, 0].min() + on_slice[:, 0].max()) / 2
        laterality = "left" if centroid[0] > mid_i else "right"

        side = np.argwhere(body)
        side = side[side[:, 0] > mid_i] if laterality == "left" else side[side[:, 0] < mid_i]
        nipple = side[np.argmin(side[:, 1])]
        n_mm = nipple * spacing

        dx, dz = c_mm[0] - n_mm[0], c_mm[2] - n_mm[2]
        chest_wall_y = CHEST_WALL_Y_MM[channel]
        third = depth(c_mm[1], n_mm[1], chest_wall_y)
        out[channel] = {
            "voxels": int(len(voxels)),
            "centroid_ijk": [round(float(v), 1) for v in centroid],
            "nipple_ijk": [int(v) for v in nipple],
            "laterality": laterality,
            "clock_position": clock_position(dx, dz),
            "quadrant": quadrant(dx, dz, laterality, third),
            "depth": third,
            "distance_skin_cm": round(float(to_skin[tuple(voxels.T)].min()) / 10, 1),
            "distance_nipple_cm": round(float(np.linalg.norm(mm - n_mm, axis=1).min()) / 10, 1),
            "distance_ribcage_cm": round((chest_wall_y - float(mm[:, 1].max())) / 10, 1),
        }
    return out


if __name__ == "__main__":
    print(json.dumps(measure(), indent=2))
