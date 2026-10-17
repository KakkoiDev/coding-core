# Bound collection pagination

Validate offset and limit, then slice a stable ordered collection. Return the original total. This is local offset pagination; a changing database feed needs a stable cursor and tie-breaker. Preserve the caller input.

JavaScript implementation: [recipes](../js/recipes.mjs) — `page`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `page`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
