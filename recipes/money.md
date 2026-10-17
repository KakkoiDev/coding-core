# Use integer minor units

Store cents as nonnegative integers and quantity as an integer. JavaScript checks its safe integer range; Python rejects bool despite bool being an int subclass. This example assumes one fixed currency scale. Currency conversion, fractional rounding, tax and arbitrary decimal amounts require a separate explicit policy.

JavaScript implementation: [recipes](../js/recipes.mjs) — `totalCents`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `total_cents`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
