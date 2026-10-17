# Make time-dependent code testable

Pass a clock function. Unit tests supply a fixed value; only the host reads the actual clock. The same rule applies to random-number generation, generated IDs, HTTP clients and database handles.

JavaScript implementation: [recipes](../js/recipes.mjs) — `withTimestamp`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `with_timestamp`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
