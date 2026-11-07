// End-to-end tests for SCENARIOS.md and the JavaScript-only recipes (concurrency, task-states, sqlite, receipts): one test per scenario, named after its title.
// Each test writes a small consumer program into a scratch folder, runs it with Node like a host project would,
// and checks what it prints (and, for atomic JSON, what it leaves on disk). Given = Arrange, When = Act,
// Then = Assert.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const recipesUrl = pathToFileURL(join(root, "js/recipes.mjs")).href;
const effectsUrl = pathToFileURL(join(root, "js/effects.mjs")).href;
const statesUrl = pathToFileURL(join(root, "js/task-states.mjs")).href;
const sqliteUrl = pathToFileURL(join(root, "js/sqlite.mjs")).href;
const receiptsUrl = pathToFileURL(join(root, "js/receipts.mjs")).href;

/** Run `body` as a consumer program in a fresh folder; it prints one JSON value with `show(value)`. */
function consumer(body, { keep = false } = {}) {
  const folder = mkdtempSync(join(tmpdir(), "coding-core-e2e-"));
  const program = [
    `import * as recipes from ${JSON.stringify(recipesUrl)};`,
    `import * as effects from ${JSON.stringify(effectsUrl)};`,
    `import * as states from ${JSON.stringify(statesUrl)};`,
    `import * as sqlite from ${JSON.stringify(sqliteUrl)};`,
    `import * as receipts from ${JSON.stringify(receiptsUrl)};`,
    "const show = (value) => process.stdout.write(JSON.stringify(value));",
    "const error = (run) => { try { run(); return null; } catch (e) { return e.message; } };",
    body,
  ].join("\n");
  writeFileSync(join(folder, "consumer.mjs"), program);
  try {
    const output = execFileSync(process.execPath, ["consumer.mjs"], {
      cwd: folder,
      encoding: "utf8",
    });
    return { shown: JSON.parse(output), folder };
  } finally {
    if (!keep) rmSync(folder, { recursive: true, force: true });
  }
}

test("Normalize a list of users", () => {
  // Given users with padded names, upper-case emails, an inactive user and a repeated id
  // When I normalize the users
  const { shown } = consumer(`
    const users = [
      { id: "b", name: " Bea ", email: " BEA@Example.COM ", active: true },
      { id: "a", name: "Ada", email: "ADA@X.org", active: true },
      { id: "a", name: "Ada again", email: "other@x.org", active: true },
      { id: "c", name: "Cy", email: "cy@x.org", active: false },
    ];
    const before = JSON.stringify(users);
    const normalized = recipes.normalizeUsers(users);
    show({ normalized, unchanged: JSON.stringify(users) === before });
  `);
  // Then I get only the active users, once per id, sorted by name
  assert.deepEqual(
    shown.normalized.map((user) => user.id),
    ["a", "b"],
  );
  // And their names are trimmed and their emails are lower case
  assert.deepEqual(
    shown.normalized.map((user) => [user.name, user.email]),
    [
      ["Ada", "ada@x.org"],
      ["Bea", "bea@example.com"],
    ],
  );
  // And the list I passed in is unchanged
  assert.equal(shown.unchanged, true);
});

test("Total the cents of each customer", () => {
  // Given order lines for two customers
  // When I total them by customer
  const { shown } = consumer(`
    show(recipes.totalsByCustomer([
      { customer: "ada", cents: 250 }, { customer: "bea", cents: 99 }, { customer: "ada", cents: 1 },
    ]));
  `);
  // Then I get one total in cents per customer
  assert.deepEqual(shown, { ada: 251, bea: 99 });
});

test("Index records by id", () => {
  // Given records where two share an id
  // When I index them by id
  const { shown } = consumer(`
    show(recipes.indexById([{ id: "a", v: 1 }, { id: "b", v: 2 }, { id: "a", v: 3 }]));
  `);
  // Then each id finds one record and the last duplicate wins
  assert.deepEqual(shown, { a: { id: "a", v: 3 }, b: { id: "b", v: 2 } });
});

test("Split records into active and inactive", () => {
  // Given active records, inactive records and one without the flag
  // When I partition them by active
  const { shown } = consumer(`
    show(recipes.partitionByActive([
      { id: 1, active: true }, { id: 2, active: false }, { id: 3 }, { id: 4, active: true },
    ]).map((group) => group.map((row) => row.id)));
  `);
  // Then the active ones come first and every other record is in the second group
  assert.deepEqual(shown, [
    [1, 4],
    [2, 3],
  ]);
});

test("A valid user from outside is accepted and trimmed", () => {
  // Given a user object with a slug id and a padded name
  // When I validate it
  const { shown } = consumer(`
    show(recipes.validateUser({ id: "ada-1", name: "  Ada  ", role: "admin" }));
  `);
  // Then it is accepted with the trimmed name and only the known fields
  assert.deepEqual(shown, { ok: true, value: { id: "ada-1", name: "Ada" } });
});

test("An invalid user from outside is refused with every reason", () => {
  // Given a user with an upper-case id and a blank name, and a value that is not an object
  // When I validate them
  const { shown } = consumer(`
    show([recipes.validateUser({ id: "Ada", name: "   " }), recipes.validateUser(["ada"])]);
  `);
  // Then each is refused and the errors name every problem
  assert.deepEqual(shown, [
    { ok: false, errors: ["id must be a lowercase slug", "name is required"] },
    { ok: false, errors: ["Expected a user object"] },
  ]);
});

test("Read settings from the environment", () => {
  // Given an environment with PORT 8080 and DEBUG 1
  // When I resolve the settings
  const { shown } = consumer(`
    show([recipes.settings({ PORT: "8080", DEBUG: "1" }), recipes.settings({})]);
  `);
  // Then the port is the number 8080 and debug is on
  assert.deepEqual(shown[0], { port: 8080, debug: true });
  // And an empty environment gives port 3000 with debug off
  assert.deepEqual(shown[1], { port: 3000, debug: false });
});

test("A bad PORT is refused", () => {
  // Given an environment whose PORT is not a number between 1 and 65535
  // When I resolve the settings
  const { shown } = consumer(`
    show(["wat", "0", "65536", "80.5"].map((PORT) => error(() => recipes.settings({ PORT }))));
  `);
  // Then I get an error that says PORT must be 1..65535
  assert.deepEqual(shown, Array(4).fill("PORT must be 1..65535"));
});

test("Take one page of a collection", () => {
  // Given a collection of 45 items
  // When I ask for 20 items from offset 40
  const { shown } = consumer(`
    const items = Array.from({ length: 45 }, (_, i) => i + 1);
    show(recipes.page(items, { offset: 40, limit: 20 }));
  `);
  // Then I get the last 5 items with the total, offset and limit
  assert.deepEqual(shown, {
    items: [41, 42, 43, 44, 45],
    total: 45,
    offset: 40,
    limit: 20,
  });
});

test("An out-of-range page size is refused", () => {
  // Given a collection
  // When I ask for a page with limit 0 or 101, or a negative offset
  const { shown } = consumer(`
    const items = [1, 2, 3];
    show([{ limit: 0 }, { limit: 101 }, { offset: -1 }].map((options) => error(() => recipes.page(items, options))));
  `);
  // Then I get an error that says the allowed ranges
  assert.deepEqual(shown, Array(3).fill("offset >= 0; limit 1..100"));
});

test("Total an order in integer cents", () => {
  // Given order lines with prices in cents and quantities
  // When I total the order
  const { shown } = consumer(`
    show(recipes.totalCents([{ cents: 105, quantity: 3 }, { cents: 10, quantity: 1 }, { cents: 999, quantity: 0 }]));
  `);
  // Then I get the exact total in cents
  assert.equal(shown, 325);
});

test("Fractional or negative cents are refused", () => {
  // Given an order line priced 0.1 or with a negative quantity
  // When I total the order
  const { shown } = consumer(`
    show([[{ cents: 0.1, quantity: 1 }], [{ cents: 100, quantity: -1 }]].map((lines) => error(() => recipes.totalCents(lines))));
  `);
  // Then I get an error that asks for nonnegative integer cents and quantities
  for (const message of shown)
    assert.match(message, /nonnegative .*integer cents and quantities/);
  assert.equal(shown.length, 2);
});

test("Apply events to a counter", () => {
  // Given a counter at 1
  // When I apply increment, increment, an unknown event and reset in turn
  const { shown } = consumer(`
    const start = { count: 1 };
    const seen = [];
    let state = start;
    for (const type of ["increment", "increment", "unknown", "reset"]) {
      state = recipes.transition(state, { type });
      seen.push(state.count);
    }
    show({ seen, start });
  `);
  // Then the counter reads 2, 3, 3 and 0 after each event
  assert.deepEqual(shown.seen, [2, 3, 3, 0]);
  // And the starting state is unchanged
  assert.deepEqual(shown.start, { count: 1 });
});

test("Stamp a record with an injected clock", () => {
  // Given a record and a clock that always says 42
  // When I stamp the record
  const { shown } = consumer(`
    const record = { id: "a" };
    show({ stamped: recipes.withTimestamp(record, () => 42), record });
  `);
  // Then the new record has updatedAt 42 and the original has no updatedAt
  assert.deepEqual(shown, {
    stamped: { id: "a", updatedAt: 42 },
    record: { id: "a" },
  });
});

test("Retry a transient failure until it succeeds", () => {
  // Given an operation that fails twice with a retryable error, then returns 9
  // When I retry it with an injected sleep
  const { shown } = consumer(`
    const attempts = [], sleeps = [];
    const value = await effects.retry(async (attempt) => {
      attempts.push(attempt);
      if (attempt < 3) throw Object.assign(new Error("busy"), { retryable: true });
      return 9;
    }, { sleep: async (ms) => sleeps.push(ms) });
    show({ value, attempts, sleeps });
  `);
  // Then I get 9 after three attempts
  assert.equal(shown.value, 9);
  assert.deepEqual(shown.attempts, [1, 2, 3]);
  // And the sleeps grew from the first delay to double it
  assert.deepEqual(shown.sleeps, [100, 200]);
});

test("A permanent failure is not retried", () => {
  // Given an operation that fails with an error that is not retryable
  // When I retry it
  const { shown } = consumer(`
    const attempts = [], sleeps = [];
    let message = null;
    try {
      await effects.retry(async (attempt) => { attempts.push(attempt); throw new Error("invalid input"); },
        { sleep: async (ms) => sleeps.push(ms) });
    } catch (e) { message = e.message; }
    show({ message, attempts, sleeps });
  `);
  // Then that error reaches me after a single attempt and nothing slept
  assert.deepEqual(shown, {
    message: "invalid input",
    attempts: [1],
    sleeps: [],
  });
});

test("Replace a JSON file atomically", () => {
  // Given a scratch folder with data.json holding version 1
  // When I write version 2 to data.json atomically
  const { folder } = consumer(
    `
    await effects.writeJsonAtomic("data.json", { version: 1 });
    await effects.writeJsonAtomic("data.json", { version: 2, name: "東京" });
    show(null);
  `,
    { keep: true },
  );
  try {
    // Then data.json holds version 2 as indented JSON with a final newline
    assert.equal(
      readFileSync(join(folder, "data.json"), "utf8"),
      '{\n  "version": 2,\n  "name": "東京"\n}\n',
    );
    // And the folder holds no temporary file
    assert.deepEqual(readdirSync(folder).sort(), ["consumer.mjs", "data.json"]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("Run work with bounded concurrency in input order", () => {
  // Given four items, an operation that finishes them out of order, and a limit of 2
  // When I map the operation over the items with mapConcurrent
  const { shown } = consumer(`
    let active = 0, peak = 0;
    const finished = [];
    const results = await effects.mapConcurrent([4, 1, 3, 2], 2, async (ticks) => {
      active++;
      peak = Math.max(peak, active);
      for (let i = 0; i < ticks; i++) await Promise.resolve(); // later items can finish first
      active--;
      finished.push(ticks);
      return ticks * 10;
    });
    let refused = null;
    try { await effects.mapConcurrent([1], 0, async (x) => x); } catch (e) { refused = e.message; }
    show({ peak, finished, results, refused });
  `);
  // Then no more than 2 operations ran at once
  assert.equal(shown.peak, 2);
  assert.notDeepEqual(shown.finished, [4, 1, 3, 2]);
  // And the results are in the order of the items
  assert.deepEqual(shown.results, [40, 10, 30, 20]);
  // And a limit of 0 is refused
  assert.equal(shown.refused, "concurrency must be 1..16");
});

test("Move a todo from pending to done with evidence", () => {
  // Given a pending todo and the task transition table
  // When I start it and then verify it with a test as evidence
  const { shown } = consumer(`
    const table = states.taskTransitions;
    const started = states.transition(table, "pending", "start", { blockedBy: [] });
    const verified = states.transition(table, started.to, "verify", {
      evidence: [{ kind: "test", ref: "tests/plan.test.mjs#two-steps" }],
    });
    const reopened = states.transition(table, verified.to, "reopen");
    show({ started, verified, reopened, offered: states.allowedEvents(table, "pending", { reason: "x" }) });
  `);
  // Then it is done
  assert.deepEqual(shown.started, {
    ok: true,
    from: "pending",
    to: "in_progress",
    event: "start",
  });
  assert.equal(shown.verified.to, "done");
  // And reopening it makes it pending again
  assert.equal(shown.reopened.to, "pending");
  // And the next events offered for a pending todo are start, block and cancel
  assert.deepEqual(shown.offered, ["start", "block", "cancel"]);
});

test("An illegal or unguarded change is refused with a reason", () => {
  // Given the task transition table
  // When I verify a pending todo, verify an in-progress todo without evidence, or start a todo whose dependency is open
  const { shown } = consumer(`
    const table = states.taskTransitions;
    show([
      states.transition(table, "pending", "verify", { evidence: [{ kind: "test", ref: "t" }] }),
      states.transition(table, "in_progress", "verify", { evidence: [] }),
      states.transition(table, "in_progress", "verify", { evidence: [{ kind: "vibes", ref: "trust me" }] }),
      states.transition(table, "pending", "start", { blockedBy: ["Write the outline"] }),
    ]);
  `);
  // Then each change is refused
  assert.deepEqual(
    shown.map((result) => result.ok),
    [false, false, false, false],
  );
  // And the errors list the allowed events, ask for evidence, and name the open dependency
  assert.equal(
    shown[0].error,
    "Cannot verify from pending (allowed: start, block, cancel)",
  );
  assert.match(shown[1].error, /evidence is required/);
  assert.match(shown[2].error, /evidence must be/);
  assert.equal(
    shown[3].error,
    "Cannot start from pending: waits for Write the outline",
  );
});

test("A table that leads to an unknown state is refused", () => {
  // Given a transition table where an event leads to a state that is not in the table
  // When I define it
  const { shown } = consumer(`
    show(error(() => states.defineTransitions({ open: { close: { to: "closed" } } })));
  `);
  // Then I get an error that names the state and event
  assert.equal(shown, "open --close--> leads to an unknown state");
});

test("Migrate a database to the latest schema once", () => {
  // Given a new database file and two migrations
  // When I migrate it, and then migrate it again
  const { shown } = consumer(`
    const migrations = [
      "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT NOT NULL)",
      (db) => db.exec("ALTER TABLE notes ADD COLUMN done INTEGER NOT NULL DEFAULT 0"),
    ];
    const db = sqlite.openDatabase("app.db");
    const first = sqlite.migrate(db, migrations);
    const second = sqlite.migrate(db, migrations);
    const columns = db.prepare("SELECT name FROM pragma_table_info('notes')").all().map((c) => c.name);
    const older = error(() => sqlite.migrate(db, migrations.slice(0, 1)));
    db.close();
    show({ first, second, columns, older });
  `);
  // Then the first run goes from version 0 to 2 and the second changes nothing
  assert.deepEqual(shown.first, { from: 0, to: 2 });
  assert.deepEqual(shown.second, { from: 2, to: 2 });
  assert.deepEqual(shown.columns, ["id", "body", "done"]);
  // And code that knows only one migration refuses the newer database
  assert.equal(
    shown.older,
    "Database schema 2 is newer than this code (knows 1)",
  );
});

test("A failed transaction leaves nothing behind", () => {
  // Given a database with a notes table
  // When a transaction inserts a note and then fails, and another body returns a promise
  const { shown } = consumer(`
    const db = sqlite.openDatabase(":memory:");
    db.exec("CREATE TABLE notes (body TEXT)");
    const failed = error(() => sqlite.transaction(db, () => {
      db.prepare("INSERT INTO notes VALUES (?)").run("half-done");
      throw new Error("disk full");
    }));
    const asynchronous = error(() => sqlite.transaction(db, async () => {
      db.prepare("INSERT INTO notes VALUES (?)").run("too early");
    }));
    show({ failed, asynchronous, count: db.prepare("SELECT count(*) AS n FROM notes").get().n });
  `);
  // Then the table is still empty
  assert.equal(shown.failed, "disk full");
  assert.equal(shown.count, 0);
  // And the promise body is refused as not synchronous
  assert.equal(
    shown.asynchronous,
    "A transaction body must be synchronous; await outside it",
  );
});

test("Two processes increment a counter without losing an update", () => {
  // Given a database file with a counter at 0
  // When two processes each increment it 200 times in transactions at the same time
  const writer = [
    `import * as sqlite from ${JSON.stringify(sqliteUrl)};`,
    "const db = sqlite.openDatabase('counter.db', { busyTimeoutMs: 20000 });",
    "for (let i = 0; i < 200; i++) sqlite.transaction(db, () => {",
    "  const { n } = db.prepare('SELECT n FROM counter').get();",
    "  db.prepare('UPDATE counter SET n = ?').run(n + 1);",
    "});",
  ].join("\n");
  const { shown } = consumer(`
    const { spawn } = await import("node:child_process");
    const { writeFileSync } = await import("node:fs");
    const db = sqlite.openDatabase("counter.db");
    db.exec("CREATE TABLE counter (n INTEGER NOT NULL); INSERT INTO counter VALUES (0)");
    writeFileSync("writer.mjs", ${JSON.stringify(writer)});
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["writer.mjs"], { stdio: "inherit" });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("writer exited " + code))));
    });
    await Promise.all([run(), run()]);
    show(db.prepare("SELECT n FROM counter").get().n);
  `);
  // Then the counter is 400
  assert.equal(shown, 400);
});

test("An operation delivered twice acts once", () => {
  // Given a database with receipts and an operation that adds a row
  // When the same operation key is delivered twice
  const { shown } = consumer(`
    const db = sqlite.openDatabase(":memory:");
    db.exec("CREATE TABLE items (title TEXT)");
    const store = receipts.createReceipts(db, { now: () => "2026-11-08T00:00:00Z" });
    const key = receipts.operationKey("plan", "p1", "add", "Write the outline");
    const add = () => store.once(key, "add-item", () => {
      db.prepare("INSERT INTO items VALUES (?)").run("Write the outline");
      return { position: db.prepare("SELECT count(*) AS n FROM items").get().n };
    });
    const first = add();
    const second = add();
    show({ first, second, rows: db.prepare("SELECT count(*) AS n FROM items").get().n,
      sameKey: key === receipts.operationKey("plan", "p1", "add", "Write the outline") });
  `);
  // Then the row is added once
  assert.equal(shown.rows, 1);
  assert.equal(shown.sameKey, true);
  // And the second delivery is marked replayed and returns the first result
  assert.deepEqual(shown.first, { result: { position: 1 }, replayed: false });
  assert.deepEqual(shown.second, { result: { position: 1 }, replayed: true });
});

test("A failed operation leaves no receipt and can be retried", () => {
  // Given an operation that fails the first time
  // When it is delivered, fails, and is delivered again
  const { shown } = consumer(`
    const db = sqlite.openDatabase(":memory:");
    const store = receipts.createReceipts(db);
    let calls = 0;
    const deliver = () => store.once("op_send", "send", () => {
      calls++;
      if (calls === 1) throw new Error("transient");
      return { sent: true };
    });
    const failed = error(deliver);
    const retried = deliver();
    show({ failed, retried, calls, receipts: db.prepare("SELECT count(*) AS n FROM receipts").get().n });
  `);
  // Then the second delivery runs and succeeds
  assert.equal(shown.failed, "transient");
  assert.deepEqual(shown.retried, { result: { sent: true }, replayed: false });
  assert.equal(shown.calls, 2);
  // And only one receipt exists
  assert.equal(shown.receipts, 1);
});

test("An unsettled external effect is reported for reconciliation", () => {
  // Given an external effect reserved under a key but not settled
  // When the same key is reserved again
  const { shown } = consumer(`
    const db = sqlite.openDatabase(":memory:");
    const store = receipts.createReceipts(db, { now: () => "2026-11-08T00:00:00Z" });
    const first = store.reserve("op_generate", "generate");
    const again = store.reserve("op_generate", "generate");
    const settled = store.settle("op_generate", { text: "Outline ready" });
    const after = store.reserve("op_generate", "generate");
    show({ first: first.state, again: again.state, settled: settled.replayed, after: [after.state, after.result] });
  `);
  // Then the reservation is reported as pending instead of new
  assert.equal(shown.first, "new");
  assert.equal(shown.again, "pending");
  // And after settling, reserving again returns the settled result
  assert.equal(shown.settled, false);
  assert.deepEqual(shown.after, ["done", { text: "Outline ready" }]);
});
