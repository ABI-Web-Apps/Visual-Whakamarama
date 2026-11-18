"""GET /api/patients/{assay}/{cohort}/report.pdf, /report/pages and /report/pages/{n}.png.

The report is the client's one-page patient summary, shipped for sub-1 only until it becomes a
dataset input (`app.reports.summary`).
"""

import io
from pathlib import Path

import pypdfium2 as pdfium
import pytest
from PIL import Image

from app.reports import summary

SHIPPED = Path(summary.__file__).with_name("sub-1-patient-summary.pdf")
REPORT = "/api/patients/assay-001/{}/report.pdf"
PAGES = "/api/patients/assay-001/{}/report/pages"
PAGE = "/api/patients/assay-001/{}/report/pages/{}.png"


def _blank_pdf(pages: int) -> bytes:
    doc = pdfium.PdfDocument.new()
    try:
        for _ in range(pages):
            doc.new_page(595, 842)
        buffer = io.BytesIO()
        doc.save(buffer)
        return buffer.getvalue()
    finally:
        doc.close()


@pytest.fixture()
def two_page_report(monkeypatch) -> bytes:
    """sub-1's report replaced by a blank two-page PDF: the future, multi-page dataset input."""
    pdf = _blank_pdf(2)
    monkeypatch.setattr(summary, "summary_pdf", lambda cohort: pdf if cohort == summary.SUMMARY_COHORT else None)
    return pdf


def test_sub1_report_is_the_summary_pdf(loaded_client):
    response = loaded_client.get(REPORT.format("sub-1"))
    assert response.status_code == 200
    assert response.content == SHIPPED.read_bytes()
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == 'inline; filename="sub-1-mri-report.pdf"'
    assert response.headers["cache-control"] == "no-store"


def test_other_cohort_has_no_report(loaded_client):
    for url in (REPORT.format("sub-2"), PAGES.format("sub-2"), PAGE.format("sub-2", 0)):
        response = loaded_client.get(url)
        assert response.status_code == 404, url
        assert response.json()["detail"] == {"code": "no_report", "summary": "No report is available for this scan."}


def test_another_summary_cohort_is_served(loaded_client, monkeypatch):
    monkeypatch.setattr(summary, "SUMMARY_COHORT", "sub-2")
    assert loaded_client.get(REPORT.format("sub-2")).status_code == 200
    assert loaded_client.get(REPORT.format("sub-1")).status_code == 404


def test_report_ignores_tz(loaded_client):
    response = loaded_client.get(REPORT.format("sub-1"), params={"tz": "Pacific/Auckland"})
    assert response.status_code == 200
    assert response.content == SHIPPED.read_bytes()


def test_pages_lists_every_page(loaded_client):
    response = loaded_client.get(PAGES.format("sub-1"))
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert set(body) == {"version", "pages"}
    assert body["version"] == summary.pdf_version(SHIPPED.read_bytes())
    assert len(body["version"]) == 12 and int(body["version"], 16) >= 0
    [page] = body["pages"]
    assert page["width"] == pytest.approx(595, abs=1) and page["height"] == pytest.approx(842, abs=1)
    assert "Your breast MRI: what we found" in page["text"]


def test_pages_lists_every_page_of_a_multi_page_pdf(loaded_client, two_page_report):
    body = loaded_client.get(PAGES.format("sub-1")).json()
    assert body["version"] == summary.pdf_version(two_page_report)
    assert [(p["width"], p["height"]) for p in body["pages"]] == [(595, 842), (595, 842)]
    assert loaded_client.get(PAGE.format("sub-1", 1)).status_code == 200
    assert loaded_client.get(PAGE.format("sub-1", 2)).status_code == 404


def test_page_png_is_1600_wide(loaded_client, cache_dir):
    response = loaded_client.get(PAGE.format("sub-1", 0))
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"\x89PNG\r\n\x1a\n")
    with Image.open(io.BytesIO(response.content)) as image:
        width, height = image.size
    assert width == 1600
    assert height == pytest.approx(1600 * 842 / 595, abs=2)


@pytest.mark.parametrize("width_pt", [595, 594.96, 612, 333.3])
def test_render_hits_the_width_exactly(width_pt):
    """A scale of width_px / width_pt can round the canvas up by a pixel; the renderer must not."""
    doc = pdfium.PdfDocument.new()
    try:
        doc.new_page(width_pt, 842)
        buffer = io.BytesIO()
        doc.save(buffer)
    finally:
        doc.close()
    with Image.open(io.BytesIO(summary.render_page_png(buffer.getvalue(), 0))) as image:
        assert image.size[0] == 1600


@pytest.mark.parametrize("index", [1, 99, -1])
def test_page_out_of_range_404(loaded_client, cache_dir, index):
    response = loaded_client.get(PAGE.format("sub-1", index))
    assert response.status_code == 404
    assert response.json()["detail"]["code"] == "no_page"
    assert not cache_dir.exists() or list(cache_dir.iterdir()) == []


def test_render_page_png_raises_index_error_out_of_range():
    pdf = SHIPPED.read_bytes()
    for index in (1, -1):
        with pytest.raises(IndexError):
            summary.render_page_png(pdf, index)


def test_page_png_is_cached(loaded_client, cache_dir, monkeypatch):
    calls = []
    render = summary.render_page_png

    def counting(pdf, index, width_px=1600):
        calls.append(index)
        return render(pdf, index, width_px)

    monkeypatch.setattr(summary, "render_page_png", counting)
    first = loaded_client.get(PAGE.format("sub-1", 0))
    second = loaded_client.get(PAGE.format("sub-1", 0))
    assert first.status_code == second.status_code == 200
    assert first.content == second.content
    assert calls == [0]


def test_a_changed_pdf_is_rendered_again(loaded_client, cache_dir, monkeypatch):
    assert loaded_client.get(PAGE.format("sub-1", 0)).status_code == 200
    calls = []
    render = summary.render_page_png
    monkeypatch.setattr(summary, "summary_pdf", lambda cohort: _blank_pdf(1))
    monkeypatch.setattr(summary, "render_page_png", lambda pdf, index, width_px=1600: calls.append(index) or render(pdf, index, width_px))
    assert loaded_client.get(PAGE.format("sub-1", 0)).status_code == 200
    assert calls == [0]


def test_unknown_assay_409_on_pages(client):
    for url in (REPORT.format("sub-1"), PAGES.format("sub-1"), PAGE.format("sub-1", 0)):
        response = client.get(url)
        assert response.status_code == 409, url
        assert response.json()["detail"]["code"] == "assay_not_loaded"


def test_unknown_cohort_404_on_pages(loaded_client):
    for url in (REPORT.format("sub-9"), PAGES.format("sub-9"), PAGE.format("sub-9", 0)):
        response = loaded_client.get(url)
        assert response.status_code == 404, url
        assert response.json()["detail"]["code"] == "unknown_cohort"


def test_summary_pdf_is_only_for_the_summary_cohort():
    assert summary.SUMMARY_COHORT == "sub-1"
    assert summary.summary_pdf("sub-1") == SHIPPED.read_bytes()
    assert summary.summary_pdf("sub-2") is None
    assert summary.summary_pdf("../sub-1") is None
