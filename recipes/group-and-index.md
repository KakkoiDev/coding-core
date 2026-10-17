# Group, summarize and index collections

Group order lines by customer and sum integer cents. Indexing uses last duplicate wins; use validation when duplicates are errors. Partition active/inactive records without altering their order. Do not equate these duplicate policies with deduplication, which keeps the first record.

JavaScript implementation: [recipes](../js/recipes.mjs) — `totalsByCustomer / indexById / partitionByActive`.

Python implementation: [recipes](../python/coding_core/recipes.py) — `totals_by_customer / index_by_id / partition_by_active`.

Run the behavioral cases in [JavaScript tests](../tests/recipes.test.mjs) and [Python tests](../tests/test_recipes.py). Start from the closest test and change its inputs to the project domain.

Before finishing, check both the expected result and an invalid/boundary input. For transformations, verify the original input stays unchanged. Preserve the host error/return conventions instead of introducing a second framework.
