"""Bridge the Node engine regression suite into the repo's pytest command.

The statistical engine (js/statistics.js, js/meta-analysis.js,
js/data-handler.js) has no Python surface; its runnable unit/regression tests
live in tests/js/engine_regressions.mjs and run under Node's built-in test
runner. This wrapper shells out to Node so that `python -m pytest -q` (the
repo's declared test command) and CI exercise the engine too.

If Node is not installed the test is skipped rather than failed, so the
Python-only contract suite still runs in minimal environments.
"""
import shutil
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
JS_SUITE = REPO_ROOT / "tests" / "js" / "engine_regressions.mjs"


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js not available")
def test_js_engine_regressions():
    assert JS_SUITE.is_file(), f"missing JS regression suite: {JS_SUITE}"
    result = subprocess.run(
        ["node", "--test", str(JS_SUITE)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    # Node's test runner exits non-zero if any test fails.
    assert result.returncode == 0, (
        "Node engine regression suite failed:\n"
        f"STDOUT:\n{result.stdout}\n\nSTDERR:\n{result.stderr}"
    )
