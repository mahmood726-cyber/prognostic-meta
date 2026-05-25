"""Pytest contracts for PrognosticMeta static app artifacts."""

from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
INDEX_HTML = REPO_ROOT / "index.html"
TEST_HARNESS_DIR = REPO_ROOT / "tests"
DOCS_DIR = REPO_ROOT / "docs"
SCRIPT_SRC_RE = re.compile(r'<script\s+src="([^"]+)"', re.IGNORECASE)


def test_main_app_shell_exposes_core_entry_markers() -> None:
    html = INDEX_HTML.read_text(encoding="utf-8")

    assert "<title>PrognosisMeta - Prognostic Factor & Prediction Model Meta-Analysis</title>" in html
    assert 'id="app"' in html
    assert "Main Application Controller" in html
    assert "PrognosisMeta ready!" in html


def test_browser_harnesses_reference_existing_js_assets() -> None:
    harnesses = sorted(TEST_HARNESS_DIR.glob("*.html"))

    assert harnesses, "expected browser harness HTML files under tests/"

    for harness in harnesses:
        html = harness.read_text(encoding="utf-8")
        script_srcs = SCRIPT_SRC_RE.findall(html)

        assert script_srcs, f"{harness.name} should reference external JS assets"

        missing = [
            src
            for src in script_srcs
            if not src.startswith(("http://", "https://"))
            if not (harness.parent / src).resolve().is_file()
        ]
        assert not missing, f"{harness.name} references missing assets: {missing}"


def test_validation_docs_are_present() -> None:
    assert (DOCS_DIR / "VALIDATION_VS_R.md").is_file()
    assert (DOCS_DIR / "R_VALIDATION_RESULTS.md").is_file()
