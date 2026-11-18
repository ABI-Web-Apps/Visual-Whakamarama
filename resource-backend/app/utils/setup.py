"""Backend configuration: which sample types are read, and where MinIO is."""

import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


def default_feedback_dir() -> Path:
    """Where feedback and Stay in touch sign-ups go when FEEDBACK_DIR is not set: a local run.

    Never inside BACKEND_ROOT. A portal local-folder upload copies resource-backend/ into the
    public tools bucket, and readers' comments and contacts must not travel with it.
    """
    return Path.home() / ".visual-whakamarama" / "feedback"


class Config:
    METADATA_PATH = "manifest.xlsx"
    SAMPLES_METADATA_PATH = "samples.xlsx"
    SUBJECTS_METADATA_PATH = "subjects.xlsx"

    # Resolved by NAME from each dataset's samples.xlsx "Sample Type" column, so
    # the list has no index semantics. The series shown is registration_1, contrast
    # phase 1 after registration: the Clinician Layer mask lies on its grid, not on
    # raw contrast_1's, whose header differs by 0.6-1.8 mm across the volume.
    INPUTS = [
        "registration_1_nrrd",
        "researcher_manual_LPS_nii",
        "findings_json",
    ]
    # Nothing is ever written back to MinIO.
    OUTPUTS: list[str] = []

    # MinIO SDK credentials. Local default: minioadmin/minioadmin @ localhost:9000.
    # Docker: injected through compose environment.
    MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY = os.environ.get("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.environ.get("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE = os.environ.get("MINIO_SECURE", "false").lower() in ("true", "1")

    # Derived artefacts (meshes, report page images); never decompressed patient images.
    CACHE_DIR = Path(os.environ.get("DERIVED_CACHE_DIR", BACKEND_ROOT / "cache"))

    # Anonymous feedback and Stay in touch sign-ups, one JSON line per entry
    # (app/router/feedback.py, subscribers.py). Docker: the feedback_data volume; a local run:
    # default_feedback_dir(). The password opens the lists; only the backend ever checks it.
    FEEDBACK_DIR = Path(os.environ.get("FEEDBACK_DIR") or default_feedback_dir())
    FEEDBACK_ADMIN_PASSWORD = os.environ.get("FEEDBACK_ADMIN_PASSWORD", "qwerty")
