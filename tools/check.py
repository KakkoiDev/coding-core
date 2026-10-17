"""Offline contract checks. Contributor lint/format tools are a separate gate."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def check():
    lock = json.loads((ROOT / "vendor/LOCK.json").read_text())
    for source in lock["sources"]:
        directory = ROOT / "vendor" / source["id"]
        files = {
            str(p.relative_to(directory)): p
            for p in directory.rglob("*")
            if p.is_file() and "__pycache__" not in p.parts and p.suffix != ".pyc"
        }
        if set(files) != set(source["sha256"]):
            raise ValueError("Vendor file set changed")
        for name, p in files.items():
            if (
                p.is_symlink()
                or hashlib.sha256(p.read_bytes()).hexdigest() != source["sha256"][name]
            ):
                raise ValueError(f"Vendor drift: {name}")
    for file in ROOT.rglob("*.md"):
        if any(
            p.startswith(".") or p in ("vendor", "node_modules", "dist")
            for p in file.relative_to(ROOT).parts
        ):
            continue
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", file.read_text()):
            if (
                "://" not in target
                and not target.startswith("#")
                and not (file.parent / target.split("#")[0]).exists()
            ):
                raise ValueError(f"Broken link {file}: {target}")
    subprocess.run(["node", "--test", "tests/recipes.test.mjs"], cwd=ROOT, check=True)
    subprocess.run(
        [sys.executable, "-B", "-m", "unittest", "discover", "-s", "tests", "-v"],
        cwd=ROOT,
        check=True,
    )
    subprocess.run([sys.executable, "-B", "tools/build.py"], cwd=ROOT, check=True)
    print("Vendor, documentation, JS/Python recipes and source build passed.")


if __name__ == "__main__":
    check()
