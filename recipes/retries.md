# Retry only bounded transient operations

Inject the operation, delay and retry predicate. The default retries only explicitly retryable errors, at most three attempts. Validation/authentication failures must fail immediately. Never retry non-idempotent writes without an idempotency mechanism. The example does not add cancellation or jitter; add them explicitly when required.

JavaScript implementation: [effects](../js/effects.mjs) — `retry`.

Python implementation: [effects](../python/coding_core/effects.py) — `retry`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
