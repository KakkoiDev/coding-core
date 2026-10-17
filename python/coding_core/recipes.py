"""Pure data transformations; effects are in effects.py."""

from toolz import assoc, groupby, pipe, valmap
from toolz.curried import filter, map, unique


def normalize_users(users):
    return pipe(
        users,
        map(
            lambda user: {
                **user,
                "name": user["name"].strip(),
                "email": user["email"].strip().lower(),
            }
        ),
        filter(lambda user: user["active"] is True),
        unique(key=lambda user: user["id"]),
        lambda rows: sorted(rows, key=lambda user: (user["name"], user["id"])),
    )


def totals_by_customer(lines):
    return pipe(
        lines,
        lambda rows: groupby("customer", rows),
        lambda groups: valmap(lambda rows: sum(row["cents"] for row in rows), groups),
    )


def index_by_id(rows):
    """Last duplicate wins. Validate uniqueness separately when duplicates are errors."""
    return {row["id"]: row for row in rows}


def partition_by_active(rows):
    return (
        [row for row in rows if row.get("active") is True],
        [row for row in rows if row.get("active") is not True],
    )


def validate_user(value):
    if not isinstance(value, dict):
        return {"ok": False, "errors": ["Expected a user object"]}
    import re

    errors = []
    if not isinstance(value.get("id"), str) or not re.fullmatch(
        "[a-z][a-z0-9-]{0,39}", value["id"]
    ):
        errors.append("id must be a lowercase slug")
    if not isinstance(value.get("name"), str) or not value["name"].strip():
        errors.append("name is required")
    return (
        {"ok": False, "errors": errors}
        if errors
        else {"ok": True, "value": {"id": value["id"], "name": value["name"].strip()}}
    )


def page(items, offset=0, limit=20):
    if type(offset) is not int or offset < 0 or type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("offset >= 0; limit 1..100")
    return {
        "items": items[offset : offset + limit],
        "total": len(items),
        "offset": offset,
        "limit": limit,
    }


def transition(state, event):
    if event["type"] == "increment":
        return assoc(state, "count", state["count"] + 1)
    if event["type"] == "reset":
        return assoc(state, "count", 0)
    return state


def total_cents(lines):
    if not all(
        type(row["cents"]) is int
        and row["cents"] >= 0
        and type(row["quantity"]) is int
        and row["quantity"] >= 0
        for row in lines
    ):
        raise ValueError("Use nonnegative integer cents and quantities")
    return sum(row["cents"] * row["quantity"] for row in lines)


def settings(environment):
    try:
        port = int(environment.get("PORT", "3000"))
    except (ValueError, TypeError) as error:
        raise ValueError("PORT must be 1..65535") from error
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be 1..65535")
    return {"port": port, "debug": environment.get("DEBUG") == "1"}


def with_timestamp(record, now):
    return assoc(record, "updatedAt", now())
