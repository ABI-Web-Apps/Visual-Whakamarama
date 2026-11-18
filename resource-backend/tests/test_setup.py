import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.utils.setup import BACKEND_ROOT, Config


def test_inputs_are_the_three_sample_types():
    assert Config.INPUTS == ["registration_1_nrrd", "researcher_manual_LPS_nii", "findings_json"]


def test_outputs_are_empty():
    assert Config.OUTPUTS == []


def test_workdir_is_not_shipped():
    assert "static/workdir/" in (BACKEND_ROOT / ".dockerignore").read_text()


def test_default_feedback_dir_is_outside_the_source_tree():
    """A portal local-folder upload copies resource-backend/ into the public tools bucket, so
    readers' feedback and contacts must never be written inside it by default."""
    from app.utils.setup import default_feedback_dir

    folder = default_feedback_dir().resolve()
    root = BACKEND_ROOT.resolve()
    assert folder != root and root not in folder.parents
    assert default_feedback_dir() == Path.home() / ".visual-whakamarama" / "feedback"


@pytest.mark.parametrize("env, expected", [(None, "default"), ("", "default"), ("/resource_backend/feedback", "/resource_backend/feedback")])
def test_feedback_dir_comes_from_the_environment(env, expected):
    """Docker sets FEEDBACK_DIR to its volume; unset or empty is the default. Read in a fresh
    interpreter: Config is evaluated once, at import."""
    from app.utils.setup import default_feedback_dir

    environ = {k: v for k, v in os.environ.items() if k != "FEEDBACK_DIR"}
    if env is not None:
        environ["FEEDBACK_DIR"] = env
    result = subprocess.run(
        [sys.executable, "-c", "from app.utils.setup import Config; print(Config.FEEDBACK_DIR)"],
        cwd=BACKEND_ROOT, env=environ, capture_output=True, text=True, check=True,
    )
    want = default_feedback_dir() if expected == "default" else Path(expected)
    assert Path(result.stdout.strip()) == want


def test_feedback_is_not_shipped():
    assert "feedback/" in (BACKEND_ROOT / ".dockerignore").read_text().splitlines()


def test_fixture_dataset_has_metadata(sparc_dataset):
    assert {p.name for p in sparc_dataset.glob("*.xlsx")} >= {
        "subjects.xlsx",
        "samples.xlsx",
        "manifest.xlsx",
    }
