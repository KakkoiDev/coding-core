"""Build a deterministic source kit; no runtime transpilation is needed."""

from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def build():
    target = ROOT / "dist/coding-core-0.1.0.zip"
    target.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(ROOT.rglob("*")):
            relative = file.relative_to(ROOT)
            if (
                not file.is_file()
                or any(
                    p in (".git", ".venv", ".ruff_cache", "node_modules", "__pycache__", "dist")
                    for p in relative.parts
                )
                or file.suffix == ".pyc"
            ):
                continue
            info = zipfile.ZipInfo(str(relative), date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, file.read_bytes())
    return target


if __name__ == "__main__":
    print(build())
