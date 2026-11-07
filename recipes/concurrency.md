# Bound asynchronous work

Use `mapConcurrent(items, concurrency, operation)` in [JS effects](../js/effects.mjs).
It preserves input order and caps active operations at 1..16. The
[behavioral test](../tests/recipes.test.mjs) measures actual peak concurrency.
On failure no further items are scheduled; already running operations are not
cancelled. Pass cancellation to the operation if required. Never use an unbounded
Promise.all over user-sized input.

For Python 3.11 use asyncio.TaskGroup plus a bounded worker queue for async I/O,
or a ThreadPoolExecutor for blocking I/O. A semaphore limits active operations
but does not bound the number of allocated tasks. Do not wrap pure transformations
in async just for consistency. No Python concurrent runner is shipped in v0.1.

## Scenario (JavaScript only)

Its end-to-end test is in [tests/e2e/scenarios.test.mjs](../tests/e2e/scenarios.test.mjs), named after the title.

### Scenario: Run work with bounded concurrency in input order
Given four items, an operation that finishes them out of order, and a limit of 2
When I map the operation over the items with mapConcurrent
Then no more than 2 operations ran at once
And the results are in the order of the items
And a limit of 0 is refused
