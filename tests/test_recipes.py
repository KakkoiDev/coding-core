import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "python"))
from coding_core import recipes as r
from coding_core.effects import retry, write_json_atomic


class Recipes(unittest.TestCase):
    def test_pipeline_and_grouping(self):
        users = [
            {"id": "b", "name": " Bea ", "email": " B@X ", "active": True},
            {"id": "a", "name": "Ada", "email": "A@X", "active": True},
            {"id": "a", "name": "Other", "email": "o@x", "active": True},
            {"id": "c", "name": "C", "email": "c@x", "active": False},
        ]
        before = copy.deepcopy(users)
        actual = r.normalize_users(users)
        self.assertEqual([x["id"] for x in actual], ["a", "b"])
        self.assertEqual(actual[1]["email"], "b@x")
        self.assertEqual(users, before)
        self.assertEqual(
            r.totals_by_customer([{"customer": "a", "cents": 2}, {"customer": "a", "cents": 3}]),
            {"a": 5},
        )
        self.assertEqual(r.index_by_id([{"id": "a", "x": 1}, {"id": "a", "x": 2}])["a"]["x"], 2)
        self.assertEqual([len(group) for group in r.partition_by_active(users)], [3, 1])

    def test_boundaries_and_state(self):
        self.assertFalse(r.validate_user(None)["ok"])
        self.assertEqual(r.validate_user({"id": "a", "name": " A "})["value"]["name"], "A")
        self.assertEqual(r.page([1, 2, 3], 1, 1)["items"], [2])
        with self.assertRaises(ValueError):
            r.page([], limit=0)
        state = {"count": 1}
        self.assertEqual(r.transition(state, {"type": "increment"}), {"count": 2})
        self.assertEqual(state["count"], 1)
        self.assertEqual(r.total_cents([{"cents": 105, "quantity": 3}]), 315)
        with self.assertRaises(ValueError):
            r.total_cents([{"cents": True, "quantity": 1}])
        self.assertEqual(r.settings({"PORT": "8080"}), {"port": 8080, "debug": False})
        with self.assertRaises(ValueError):
            r.settings({"PORT": "wat"})
        self.assertEqual(r.with_timestamp({"id": "a"}, lambda: 42), {"id": "a", "updatedAt": 42})

    def test_retry(self):
        delays = []
        calls = []

        class Busy(Exception):
            retryable = True

        def operation(attempt):
            calls.append(attempt)
            if attempt < 3:
                raise Busy()
            return 9

        self.assertEqual(retry(operation, sleep=delays.append), 9)
        self.assertEqual(delays, [0.1, 0.2])
        self.assertEqual(calls, [1, 2, 3])
        with self.assertRaises(ValueError):
            retry(lambda _: (_ for _ in ()).throw(ValueError("fatal")), sleep=delays.append)

    def test_atomic_file(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "data.json"
            write_json_atomic(path, {"a": 1})
            write_json_atomic(path, {"a": 2})
            self.assertEqual(json.loads(path.read_text()), {"a": 2})
            self.assertEqual(list(Path(directory).iterdir()), [path])
