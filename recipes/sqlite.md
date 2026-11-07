# Transactions and migrations with node:sqlite

`openDatabase(path)` opens a file for several connections and processes: WAL journal, foreign keys on and a busy
timeout, so a writer waits for the lock instead of failing. `transaction(db, body)` runs a synchronous body under
`BEGIN IMMEDIATE` (the write lock is taken before the first read, so read-check-write cannot race another writer),
commits its result, and rolls back and rethrows on error. Nested calls use savepoints. A body that returns a promise
is refused: it would commit before the awaited work ran. Do network calls and model generations outside the
transaction, then record their results inside one (see [receipts](receipts.md)).

`migrate(db, migrations)` takes the full ordered list of migrations (SQL text or `(db) => void`) and runs the ones
after `PRAGMA user_version`, each in its own transaction with the version bump. A database newer than the code is
refused. Never edit a shipped migration; append a new one.

Needs Node 22.13+ (node:sqlite without a flag). JavaScript implementation: [SQLite](../js/sqlite.mjs). Unit cases:
[JavaScript tests](../tests/recipes.test.mjs). Python's standard `sqlite3` module offers the same pattern
(`isolation_level=None`, explicit `BEGIN IMMEDIATE`, `PRAGMA user_version`); no Python module is shipped in v0.1.

## Scenarios (JavaScript only)

Their end-to-end tests are in [tests/e2e/scenarios.test.mjs](../tests/e2e/scenarios.test.mjs), named after the titles.

### Scenario: Migrate a database to the latest schema once
Given a new database file and two migrations
When I migrate it, and then migrate it again
Then the first run goes from version 0 to 2 and the second changes nothing
And code that knows only one migration refuses the newer database

### Scenario: A failed transaction leaves nothing behind
Given a database with a notes table
When a transaction inserts a note and then fails, and another body returns a promise
Then the table is still empty
And the promise body is refused as not synchronous

### Scenario: Two processes increment a counter without losing an update
Given a database file with a counter at 0
When two processes each increment it 200 times in transactions at the same time
Then the counter is 400
