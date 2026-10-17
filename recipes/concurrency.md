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
