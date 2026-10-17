"""Explicit I/O boundaries, bounded retries and safe temporary-file cleanup."""

import json
import os
from pathlib import Path
import tempfile


def retry(
    operation,
    *,
    sleep,
    attempts=3,
    should_retry=lambda error: getattr(error, "retryable", False) is True,
):
    if type(attempts) is not int or not 1 <= attempts <= 5:
        raise ValueError("attempts must be 1..5")
    for attempt in range(1, attempts + 1):
        try:
            return operation(attempt)
        except Exception as error:
            if attempt == attempts or not should_retry(error):
                raise
            sleep(min(0.1 * 2 ** (attempt - 1), 1))


def write_json_atomic(destination, value):
    """One-writer atomic replacement, not a concurrency lock or durability claim."""
    destination = Path(destination)
    descriptor, name = tempfile.mkstemp(prefix=f".{destination.name}-", dir=destination.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf8") as stream:
            json.dump(value, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
        os.replace(name, destination)
    finally:
        Path(name).unlink(missing_ok=True)
