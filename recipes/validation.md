# Validate external data before transforming it

Accept unknown input and return an explicit success value or field errors. Keep original data out of logs. The example validates a user ID and name; production boundaries should also reject unknown fields and enforce domain limits. Validation is pure: no database or network calls.

JavaScript implementation: [recipes](../js/recipes.mjs) — `validateUser`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `validate_user`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
