# Normalize, filter and deduplicate records

Pass a list of user records with id/name/email/active. The recipe trims names, normalizes email, keeps active records, keeps the first duplicate ID and sorts by name then ID. It returns new records. Validate the boundary first; do not quietly repair missing required fields.

JavaScript implementation: [recipes](../js/recipes.mjs) — `normalizeUsers`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `normalize_users`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
