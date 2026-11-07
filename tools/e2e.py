"""Run every end-to-end test and prove each scenario's test ran and passed (test-core protocol).

  python3 -B tools/e2e.py

1. JavaScript e2e tests (node --test, JUnit report) and Python e2e tests (unittest, JUnit report), offline.
2. tools/test-core/scenarios.py check: every scenario in SCENARIOS.md has a test of the same name in both languages
   that ran and passed; recipes/concurrency.md in JavaScript; docs/pipeline.md (the commands) in Python.
3. tools/test-core/flaky_lint.py over tests/: no fixed sleeps, timers used as waits or focused tests.
Reports go to a temporary folder, so the checkout (and the source kit) stay unchanged.
"""

from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest
from xml.sax.saxutils import quoteattr

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools/test-core"
JS_TESTS = "tests/e2e/scenarios.test.mjs"
PY_SCENARIOS = "tests/e2e/test_scenarios.py"
PY_COMMANDS = "tests/e2e/test_commands.py"


class JUnitResult(unittest.TextTestResult):
    """A text result that also remembers each test's outcome for a JUnit report."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.cases = []

    def _record(self, test, outcome, detail=""):
        self.cases.append((test.__class__.__name__, test._testMethodName, outcome, detail))

    def addSuccess(self, test):
        super().addSuccess(test)
        self._record(test, "passed")

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._record(test, "failure", self._exc_info_to_string(err, test))

    def addError(self, test, err):
        super().addError(test, err)
        self._record(test, "error", self._exc_info_to_string(err, test))

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self._record(test, "skipped", reason)


def write_junit(cases, path):
    rows = []
    for classname, name, outcome, detail in cases:
        inner = "" if outcome == "passed" else f"<{outcome} message={quoteattr(detail[-2000:])}/>"
        rows.append(
            f"<testcase classname={quoteattr(classname)} name={quoteattr(name)}>{inner}</testcase>"
        )
    path.write_text(f'<testsuite name="python-e2e">{"".join(rows)}</testsuite>\n', encoding="utf8")


def python_e2e(report):
    sys.path.insert(0, str(ROOT / "tests/e2e"))
    suite = unittest.TestSuite(
        unittest.defaultTestLoader.loadTestsFromName(Path(name).stem)
        for name in (PY_SCENARIOS, PY_COMMANDS)
    )
    runner = unittest.TextTestRunner(resultclass=JUnitResult, verbosity=2)
    started = time.monotonic()
    result = runner.run(suite)
    write_junit(result.cases, report)
    print(f"Python e2e: {len(result.cases)} tests in {time.monotonic() - started:.1f}s")
    return result.wasSuccessful()


def js_e2e(report):
    done = subprocess.run(
        [
            "node",
            "--test",
            "--test-reporter=spec",
            "--test-reporter-destination=stdout",
            "--test-reporter=junit",
            f"--test-reporter-destination={report}",
            JS_TESTS,
        ],
        cwd=ROOT,
    )
    return done.returncode == 0


def scenarios_check(task, tests, report):
    command = [sys.executable, "-B", str(TOOLS / "scenarios.py"), "check", task, "--tests", *tests]
    print(f"\nScenarios of {task} in {', '.join(tests)}:", flush=True)
    return subprocess.run([*command, "--junit", str(report)], cwd=ROOT).returncode == 0


def main():
    with tempfile.TemporaryDirectory(prefix="coding-core-reports-") as folder:
        js_report, py_report = Path(folder) / "js-e2e.xml", Path(folder) / "py-e2e.xml"
        results = [js_e2e(js_report), python_e2e(py_report)]
        results += [
            scenarios_check("SCENARIOS.md", [JS_TESTS], js_report),
            scenarios_check("SCENARIOS.md", [PY_SCENARIOS], py_report),
            scenarios_check("recipes/concurrency.md", [JS_TESTS], js_report),
            scenarios_check("docs/pipeline.md", [PY_COMMANDS], py_report),
        ]
    print("\nFlaky patterns in tests/:", flush=True)
    lint = subprocess.run([sys.executable, "-B", str(TOOLS / "flaky_lint.py"), "tests"], cwd=ROOT)
    results.append(lint.returncode == 0)
    if not all(results):
        print("End-to-end gate failed: see the lines marked NO or the failing tests above.")
        return 1
    print("End-to-end tests, scenarios and flaky lint passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
