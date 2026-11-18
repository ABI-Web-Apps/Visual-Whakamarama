"""Which report PDF belongs to a cohort, and its pages as text and images.

TEMPORARY. The report is the client's one-page patient summary, written by hand for the one
development subject and shipped in the image beside this module (`sub-1-patient-summary.pdf`).
It will become a dataset input -- a sample read from MinIO like `findings_json` (a `report_pdf`
sample type, or similar) -- at which point `summary_pdf` turns into that read and the file here
goes. So nothing outside this module may assume the PDF ships in the image: callers ask
`summary_pdf(cohort)` for the bytes and treat `None` as "this scan has no report".

Pages are read with pypdfium2. PDFium is not thread-safe -- not even across separate documents
-- and the routes that call in here run in FastAPI's threadpool, so every use of it holds
`_PDFIUM_LOCK`.
"""

import hashlib
import io
import math
import threading
from pathlib import Path

import pypdfium2 as pdfium

#: The only cohort with a report until the PDF is a dataset input.
SUMMARY_COHORT = "sub-1"

_SUMMARY_PDF = Path(__file__).with_name("sub-1-patient-summary.pdf")

_PDFIUM_LOCK = threading.Lock()


def summary_pdf(cohort: str) -> bytes | None:
    """The report PDF of `cohort`, or None when the cohort has none."""
    if cohort != SUMMARY_COHORT:
        return None
    return _SUMMARY_PDF.read_bytes()


def pdf_version(pdf: bytes) -> str:
    """A short digest of the PDF's bytes: the same report always has the same version."""
    return hashlib.sha1(pdf).hexdigest()[:12]


def page_info(pdf: bytes) -> list[dict]:
    """Every page in order: `{"width": pt, "height": pt, "text": str}`."""
    with _PDFIUM_LOCK:
        doc = pdfium.PdfDocument(pdf)
        try:
            pages = []
            for index in range(len(doc)):
                page = doc[index]
                try:
                    width, height = page.get_size()
                    textpage = page.get_textpage()
                    try:
                        # What get_text_range() with no arguments is redirected to (with a
                        # warning) in pypdfium2 4.x: the whole page's text.
                        text = textpage.get_text_bounded()
                    finally:
                        textpage.close()
                finally:
                    page.close()
                pages.append({"width": width, "height": height, "text": text})
            return pages
        finally:
            doc.close()


def _scale_for_width(width_pt: float, width_px: int) -> float:
    """The largest scale at which pypdfium2's canvas is exactly `width_px` wide.

    pypdfium2 sizes the bitmap as ceil(width_pt * scale), so width_px / width_pt can come out a
    pixel wide (595 pt at 1600 px does) when the product rounds up past the integer.
    """
    scale = width_px / width_pt
    while math.ceil(width_pt * scale) > width_px:
        scale = math.nextafter(scale, 0.0)
    return scale


def render_page_png(pdf: bytes, index: int, width_px: int = 1600) -> bytes:
    """Page `index` (0-based) rasterised `width_px` wide on white, as PNG bytes.

    Raises IndexError when the PDF has no such page (negative indexes included).
    """
    buffer = io.BytesIO()
    with _PDFIUM_LOCK:
        doc = pdfium.PdfDocument(pdf)
        try:
            if not 0 <= index < len(doc):
                raise IndexError(f"page {index} is not in a {len(doc)}-page PDF")
            page = doc[index]
            try:
                bitmap = page.render(scale=_scale_for_width(page.get_width(), width_px))
                try:
                    # Encoded before the bitmap is closed: for some pixel formats the PIL image
                    # shares the bitmap's memory rather than copying it.
                    bitmap.to_pil().save(buffer, format="PNG")
                finally:
                    bitmap.close()
            finally:
                page.close()
        finally:
            doc.close()
    return buffer.getvalue()
