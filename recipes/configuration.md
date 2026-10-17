# Resolve explicit configuration

Pass an environment mapping as input; never read process.env or os.environ inside domain functions. Validate ports before starting a service. Booleans use explicit accepted strings. Never infer a secret from an empty default or log credentials.

JavaScript implementation: [recipes](../js/recipes.mjs) — `settings`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `settings`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
