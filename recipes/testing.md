# Verify behavior, not implementation spelling

Start with the observable contract and smallest representative case. Add invalid
input, empty collections, duplicates and a boundary value when relevant. For
revisions, preserve unaffected source and history. For transformations, assert
both output and unchanged input. Inject time, randomness, clients and delay;
never rely on a real service or sleeping for a retry test.

The standard-library [JS suite](../tests/recipes.test.mjs) and
[Python suite](../tests/test_recipes.py) are runnable examples. They test actual
results, actual concurrency limits and complete file replacement. Use the host's
existing test runner in a consumer. Do not create a second test stack merely
because this repository uses Node test/unittest.
