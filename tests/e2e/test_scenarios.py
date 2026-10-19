"""End-to-end tests for SCENARIOS.md: one test per scenario, named after its title.

Each test writes a small consumer program into a scratch folder, runs it with Python like a host project would
(`coding_core` on its path, the vendored Toolz found by the package itself), and checks what it prints (and, for
atomic JSON, what it leaves on disk). Given = Arrange, When = Act, Then = Assert.
"""

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = Path(__file__).resolve().parents[2]

PRELUDE = f"""
import json, sys
sys.path.insert(0, {str(ROOT / "python")!r})
from coding_core import recipes, effects

def show(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False))

def error(run):
    try:
        run()
    except Exception as e:
        return str(e)
    return None
"""


def consumer(body, folder=None):
    """Run `body` as a consumer program in a fresh folder; it prints one JSON value with show(value)."""
    with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as scratch:
        where = Path(folder or scratch)
        (where / "consumer.py").write_text(PRELUDE + textwrap.dedent(body), encoding="utf8")
        done = subprocess.run(
            [sys.executable, "-I", "-B", "consumer.py"],
            cwd=where,
            capture_output=True,
            text=True,
            encoding="utf8",
        )
        if done.returncode:
            raise AssertionError(done.stderr)
        return json.loads(done.stdout)


class Scenarios(unittest.TestCase):
    def test_normalize_a_list_of_users(self):
        # Given users with padded names, upper-case emails, an inactive user and a repeated id
        # When I normalize the users
        shown = consumer("""
            users = [
                {"id": "b", "name": " Bea ", "email": " BEA@Example.COM ", "active": True},
                {"id": "a", "name": "Ada", "email": "ADA@X.org", "active": True},
                {"id": "a", "name": "Ada again", "email": "other@x.org", "active": True},
                {"id": "c", "name": "Cy", "email": "cy@x.org", "active": False},
            ]
            before = json.dumps(users)
            normalized = list(recipes.normalize_users(users))
            show({"normalized": normalized, "unchanged": json.dumps(users) == before})
        """)
        # Then I get only the active users, once per id, sorted by name
        self.assertEqual([user["id"] for user in shown["normalized"]], ["a", "b"])
        # And their names are trimmed and their emails are lower case
        self.assertEqual(
            [[user["name"], user["email"]] for user in shown["normalized"]],
            [["Ada", "ada@x.org"], ["Bea", "bea@example.com"]],
        )
        # And the list I passed in is unchanged
        self.assertTrue(shown["unchanged"])

    def test_total_the_cents_of_each_customer(self):
        # Given order lines for two customers
        # When I total them by customer
        shown = consumer("""
            show(recipes.totals_by_customer([
                {"customer": "ada", "cents": 250}, {"customer": "bea", "cents": 99},
                {"customer": "ada", "cents": 1},
            ]))
        """)
        # Then I get one total in cents per customer
        self.assertEqual(shown, {"ada": 251, "bea": 99})

    def test_index_records_by_id(self):
        # Given records where two share an id
        # When I index them by id
        shown = consumer("""
            show(recipes.index_by_id([{"id": "a", "v": 1}, {"id": "b", "v": 2}, {"id": "a", "v": 3}]))
        """)
        # Then each id finds one record and the last duplicate wins
        self.assertEqual(shown, {"a": {"id": "a", "v": 3}, "b": {"id": "b", "v": 2}})

    def test_split_records_into_active_and_inactive(self):
        # Given active records, inactive records and one without the flag
        # When I partition them by active
        shown = consumer("""
            groups = recipes.partition_by_active([
                {"id": 1, "active": True}, {"id": 2, "active": False}, {"id": 3}, {"id": 4, "active": True},
            ])
            show([[row["id"] for row in group] for group in groups])
        """)
        # Then the active ones come first and every other record is in the second group
        self.assertEqual(shown, [[1, 4], [2, 3]])

    def test_a_valid_user_from_outside_is_accepted_and_trimmed(self):
        # Given a user object with a slug id and a padded name
        # When I validate it
        shown = consumer("""
            show(recipes.validate_user({"id": "ada-1", "name": "  Ada  ", "role": "admin"}))
        """)
        # Then it is accepted with the trimmed name and only the known fields
        self.assertEqual(shown, {"ok": True, "value": {"id": "ada-1", "name": "Ada"}})

    def test_an_invalid_user_from_outside_is_refused_with_every_reason(self):
        # Given a user with an upper-case id and a blank name, and a value that is not an object
        # When I validate them
        shown = consumer("""
            show([recipes.validate_user({"id": "Ada", "name": "   "}), recipes.validate_user(["ada"])])
        """)
        # Then each is refused and the errors name every problem
        self.assertEqual(
            shown,
            [
                {"ok": False, "errors": ["id must be a lowercase slug", "name is required"]},
                {"ok": False, "errors": ["Expected a user object"]},
            ],
        )

    def test_read_settings_from_the_environment(self):
        # Given an environment with PORT 8080 and DEBUG 1
        # When I resolve the settings
        shown = consumer("""
            show([recipes.settings({"PORT": "8080", "DEBUG": "1"}), recipes.settings({})])
        """)
        # Then the port is the number 8080 and debug is on
        self.assertEqual(shown[0], {"port": 8080, "debug": True})
        # And an empty environment gives port 3000 with debug off
        self.assertEqual(shown[1], {"port": 3000, "debug": False})

    def test_a_bad_port_is_refused(self):
        # Given an environment whose PORT is not a number between 1 and 65535
        # When I resolve the settings
        shown = consumer("""
            show([error(lambda: recipes.settings({"PORT": p})) for p in ["wat", "0", "65536", "80.5"]])
        """)
        # Then I get an error that says PORT must be 1..65535
        self.assertEqual(shown, ["PORT must be 1..65535"] * 4)

    def test_take_one_page_of_a_collection(self):
        # Given a collection of 45 items
        # When I ask for 20 items from offset 40
        shown = consumer("""
            show(recipes.page(list(range(1, 46)), offset=40, limit=20))
        """)
        # Then I get the last 5 items with the total, offset and limit
        self.assertEqual(
            shown, {"items": [41, 42, 43, 44, 45], "total": 45, "offset": 40, "limit": 20}
        )

    def test_an_out_of_range_page_size_is_refused(self):
        # Given a collection
        # When I ask for a page with limit 0 or 101, or a negative offset
        shown = consumer("""
            items = [1, 2, 3]
            show([
                error(lambda: recipes.page(items, limit=0)),
                error(lambda: recipes.page(items, limit=101)),
                error(lambda: recipes.page(items, offset=-1)),
            ])
        """)
        # Then I get an error that says the allowed ranges
        self.assertEqual(shown, ["offset >= 0; limit 1..100"] * 3)

    def test_total_an_order_in_integer_cents(self):
        # Given order lines with prices in cents and quantities
        # When I total the order
        shown = consumer("""
            show(recipes.total_cents([
                {"cents": 105, "quantity": 3}, {"cents": 10, "quantity": 1}, {"cents": 999, "quantity": 0},
            ]))
        """)
        # Then I get the exact total in cents
        self.assertEqual(shown, 325)

    def test_fractional_or_negative_cents_are_refused(self):
        # Given an order line priced 0.1 or with a negative quantity
        # When I total the order
        shown = consumer("""
            show([
                error(lambda: recipes.total_cents([{"cents": 0.1, "quantity": 1}])),
                error(lambda: recipes.total_cents([{"cents": 100, "quantity": -1}])),
            ])
        """)
        # Then I get an error that asks for nonnegative integer cents and quantities
        self.assertEqual(shown, ["Use nonnegative integer cents and quantities"] * 2)

    def test_apply_events_to_a_counter(self):
        # Given a counter at 1
        # When I apply increment, increment, an unknown event and reset in turn
        shown = consumer("""
            start = {"count": 1}
            state, seen = start, []
            for kind in ["increment", "increment", "unknown", "reset"]:
                state = recipes.transition(state, {"type": kind})
                seen.append(state["count"])
            show({"seen": seen, "start": start})
        """)
        # Then the counter reads 2, 3, 3 and 0 after each event
        self.assertEqual(shown["seen"], [2, 3, 3, 0])
        # And the starting state is unchanged
        self.assertEqual(shown["start"], {"count": 1})

    def test_stamp_a_record_with_an_injected_clock(self):
        # Given a record and a clock that always says 42
        # When I stamp the record
        shown = consumer("""
            record = {"id": "a"}
            show({"stamped": recipes.with_timestamp(record, lambda: 42), "record": record})
        """)
        # Then the new record has updatedAt 42 and the original has no updatedAt
        self.assertEqual(shown, {"stamped": {"id": "a", "updatedAt": 42}, "record": {"id": "a"}})

    def test_retry_a_transient_failure_until_it_succeeds(self):
        # Given an operation that fails twice with a retryable error, then returns 9
        # When I retry it with an injected sleep
        shown = consumer("""
            class Busy(Exception):
                retryable = True
            attempts, sleeps = [], []
            def operation(attempt):
                attempts.append(attempt)
                if attempt < 3:
                    raise Busy("busy")
                return 9
            value = effects.retry(operation, sleep=sleeps.append)
            show({"value": value, "attempts": attempts, "sleeps": sleeps})
        """)
        # Then I get 9 after three attempts
        self.assertEqual(shown["value"], 9)
        self.assertEqual(shown["attempts"], [1, 2, 3])
        # And the sleeps grew from the first delay to double it
        self.assertEqual(shown["sleeps"], [0.1, 0.2])

    def test_a_permanent_failure_is_not_retried(self):
        # Given an operation that fails with an error that is not retryable
        # When I retry it
        shown = consumer("""
            attempts, sleeps = [], []
            def operation(attempt):
                attempts.append(attempt)
                raise ValueError("invalid input")
            message = error(lambda: effects.retry(operation, sleep=sleeps.append))
            show({"message": message, "attempts": attempts, "sleeps": sleeps})
        """)
        # Then that error reaches me after a single attempt and nothing slept
        self.assertEqual(shown, {"message": "invalid input", "attempts": [1], "sleeps": []})

    def test_replace_a_json_file_atomically(self):
        with tempfile.TemporaryDirectory(prefix="coding-core-e2e-") as folder:
            # Given a scratch folder with data.json holding version 1
            # When I write version 2 to data.json atomically
            consumer(
                """
                effects.write_json_atomic("data.json", {"version": 1})
                effects.write_json_atomic("data.json", {"version": 2, "name": "東京"})
                show(None)
                """,
                folder=folder,
            )
            # Then data.json holds version 2 as indented JSON with a final newline
            self.assertEqual(
                (Path(folder) / "data.json").read_text(encoding="utf8"),
                '{\n  "version": 2,\n  "name": "東京"\n}\n',
            )
            # And the folder holds no temporary file
            self.assertEqual(
                sorted(p.name for p in Path(folder).iterdir()), ["consumer.py", "data.json"]
            )


if __name__ == "__main__":
    unittest.main()
