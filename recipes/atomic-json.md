# Replace one JSON file safely

Write a unique sibling temporary file and rename only after complete serialization. Clean up on failure. Parent directory must already exist. This is a single-writer atomic replacement, not a transaction across files, crash-durability guarantee or writer lock. Reuse the host revision store when it already provides stronger guarantees.

JavaScript implementation: [effects](../js/effects.mjs) — `writeJsonAtomic`.

Python implementation: [effects](../python/coding_core/effects.py) — `write_json_atomic`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
