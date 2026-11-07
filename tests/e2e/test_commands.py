"""End-to-end tests for the check, build and adopt commands (scenarios in docs/pipeline.md), named after their titles.

Each test copies the repository to a scratch folder and runs the command there, as a contributor would, so the real
checkout is never changed. Given = Arrange, When = Act, Then = Assert.
"""

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import hashlib
import json
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SKIP = shutil.ignore_patterns(
    ".git", "node_modules", ".venv", "dist", "__pycache__", "*.pyc", ".ruff_cache"
)


def copy_of_repository(scratch):
    target = Path(scratch) / "coding-core"
    shutil.copytree(ROOT, target, ignore=SKIP)
    return target


def run(command, cwd):
    return subprocess.run(
        [sys.executable, "-B", *command], cwd=cwd, capture_output=True, text=True, encoding="utf8"
    )


class Commands(unittest.TestCase):
    def test_build_the_source_kit(self):
        with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as scratch:
            # Given a clean copy of the repository
            repo = copy_of_repository(scratch)
            # When I run the build twice
            first = run(["tools/build.py"], repo)
            self.assertEqual(first.returncode, 0, first.stderr)
            kit = repo / "dist/coding-core-0.1.0.zip"
            first_bytes = kit.read_bytes()
            second = run(["tools/build.py"], repo)
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertIn("coding-core-0.1.0.zip", first.stdout)
            names = set(zipfile.ZipFile(kit).namelist())
            # Then dist/coding-core-0.1.0.zip holds the recipes, the code and the vendored licences
            for expected in (
                "RECIPES.md",
                "SCENARIOS.md",
                "recipes/money.md",
                "js/recipes.mjs",
                "python/coding_core/recipes.py",
                "vendor/lodash/LICENSE",
                "vendor/LOCK.json",
                "tools/test-core/LICENSE",
            ):
                self.assertIn(expected, names)
            # And it holds no caches, dependency installs or Git data
            parts = {part for name in names for part in Path(name).parts}
            self.assertFalse(parts & {".git", "node_modules", ".venv", "__pycache__", "dist"})
            self.assertFalse([name for name in names if name.endswith(".pyc")])
            # And both builds are byte for byte the same
            self.assertEqual(kit.read_bytes(), first_bytes)

    def test_a_drifted_vendored_file_stops_the_check(self):
        with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as scratch:
            # Given a copy of the repository where one vendored Lodash file was edited
            repo = copy_of_repository(scratch)
            with (repo / "vendor/lodash/fp.js").open("a", encoding="utf8") as stream:
                stream.write("\n// edited by hand\n")
            # When I run the offline check
            done = run(["tools/check.py"], repo)
            # Then it fails and names the drifted file
            self.assertNotEqual(done.returncode, 0)
            self.assertIn("Vendor drift: fp.js", done.stderr)

    def test_a_broken_documentation_link_stops_the_check(self):
        with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as scratch:
            # Given a copy of the repository with a Markdown link to a missing file
            repo = copy_of_repository(scratch)
            (repo / "recipes/new-recipe.md").write_text(
                "# New\n\nSee [the code](../js/missing.mjs).\n", encoding="utf8"
            )
            # When I run the offline check
            done = run(["tools/check.py"], repo)
            # Then it fails and names the file and the missing target
            self.assertNotEqual(done.returncode, 0)
            self.assertRegex(
                done.stderr, r"Broken link .*recipes/new-recipe\.md: \.\./js/missing\.mjs"
            )

    def test_adopt_the_self_contained_modules_into_another_repository(self):
        with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as scratch:
            # Given a clean copy of the repository and an empty project folder
            repo = copy_of_repository(scratch)
            project = Path(scratch) / "project"
            project.mkdir()
            # When I run tools/adopt.py on the project
            done = run(["tools/adopt.py", str(project)], repo)
            self.assertEqual(done.returncode, 0, done.stderr)
            # Then the project's coding-core folder holds the three modules, the licence, adopt.py and a manifest
            copy = project / "coding-core"
            manifest = json.loads((copy / "MANIFEST.json").read_text(encoding="utf8"))
            self.assertEqual(
                sorted(manifest["files"]),
                ["LICENSE", "adopt.py", "js/receipts.mjs", "js/sqlite.mjs", "js/task-states.mjs"],
            )
            for path, digest in manifest["files"].items():
                self.assertEqual(hashlib.sha256((copy / path).read_bytes()).hexdigest(), digest)
            self.assertTrue((copy / "README.md").is_file())
            # And verifying the adopted copy passes
            verified = run([str(copy / "adopt.py"), "--verify", str(copy)], project)
            self.assertEqual(verified.returncode, 0, verified.stdout)
            self.assertIn("every file as copied", verified.stdout)
            # And running it again changes nothing
            again = run(["tools/adopt.py", str(project)], repo)
            self.assertEqual(again.returncode, 0, again.stderr)
            self.assertNotIn("add coding-core/js", again.stdout)
            self.assertNotIn("update", again.stdout)

    def test_an_adopted_module_edited_in_place_fails_the_verify(self):
        with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as scratch:
            # Given a project with coding-core adopted
            repo = copy_of_repository(scratch)
            project = Path(scratch) / "project"
            project.mkdir()
            self.assertEqual(run(["tools/adopt.py", str(project)], repo).returncode, 0)
            copy = project / "coding-core"
            # When one adopted module is edited in place and I verify the copy
            with (copy / "js/sqlite.mjs").open("a", encoding="utf8") as stream:
                stream.write("\n// edited by hand\n")
            verified = run([str(copy / "adopt.py"), "--verify", str(copy)], project)
            # Then the verify fails and names the edited file
            self.assertNotEqual(verified.returncode, 0)
            self.assertIn("edited in place: coding-core/js/sqlite.mjs", verified.stdout)


if __name__ == "__main__":
    unittest.main()
