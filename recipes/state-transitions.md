# Model events as pure state transitions

Represent events as data. Return a new state for known changes, preserve unrelated keys and keep unknown events unchanged in this small counter. A stricter domain can reject unknown event types. Let the host dispatch events and perform effects after reducing state.

JavaScript implementation: [recipes](../js/recipes.mjs) — `transition`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `transition`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
