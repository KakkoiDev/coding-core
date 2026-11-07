# Idempotent operation receipts

A request can arrive twice: a retried HTTP call, a job delivered again after its worker's lease expired, an agent
repeating a tool call. Give each side-effecting operation a stable key from what identifies it
(`operationKey("job", jobId, "step", 2)`) and keep a receipt per key. A second delivery then returns the first result
instead of acting again.

`createReceipts(db)` keeps receipts in a node:sqlite table. `once(key, operation, run)` is for effects inside the
same database: the effect and its receipt commit in one [transaction](sqlite.md), so both exist or neither does, and
a failed operation leaves no receipt and may be retried. For an external effect that cannot share the transaction,
`reserve(key, operation)` before acting and `settle(key, result)` after. A reservation that was never settled means
the effect may or may not have happened: reconcile it (look the effect up) before acting again; never replay it
blindly.

JavaScript implementation: [receipts](../js/receipts.mjs). Unit cases: [JavaScript tests](../tests/recipes.test.mjs).
No Python module is shipped in v0.1; the same table and transaction work with `sqlite3`.

## Scenarios (JavaScript only)

Their end-to-end tests are in [tests/e2e/scenarios.test.mjs](../tests/e2e/scenarios.test.mjs), named after the titles.

### Scenario: An operation delivered twice acts once
Given a database with receipts and an operation that adds a row
When the same operation key is delivered twice
Then the row is added once
And the second delivery is marked replayed and returns the first result

### Scenario: A failed operation leaves no receipt and can be retried
Given an operation that fails the first time
When it is delivered, fails, and is delivered again
Then the second delivery runs and succeeds
And only one receipt exists

### Scenario: An unsettled external effect is reported for reconciliation
Given an external effect reserved under a key but not settled
When the same key is reserved again
Then the reservation is reported as pending instead of new
And after settling, reserving again returns the settled result
