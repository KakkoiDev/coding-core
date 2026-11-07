import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as r from "../js/recipes.mjs";
import { retry, mapConcurrent, writeJsonAtomic } from "../js/effects.mjs";

test("pipeline normalizes without mutating, deduplicates and orders", () => {
  const users = [
    { id: "b", name: " Bea ", email: " B@X ", active: true },
    { id: "a", name: "Ada", email: "A@X", active: true },
    { id: "a", name: "Other", email: "o@x", active: true },
    { id: "c", name: "C", email: "c@x", active: false },
  ];
  const before = structuredClone(users),
    actual = r.normalizeUsers(users);
  assert.deepEqual(
    actual.map((x) => x.id),
    ["a", "b"],
  );
  assert.equal(actual[1].email, "b@x");
  assert.deepEqual(users, before);
  assert.deepEqual(
    r.totalsByCustomer([
      { customer: "a", cents: 2 },
      { customer: "a", cents: 3 },
    ]),
    { a: 5 },
  );
  assert.equal(
    r.indexById([
      { id: "a", x: 1 },
      { id: "a", x: 2 },
    ]).a.x,
    2,
  );
  assert.deepEqual(
    r.partitionByActive(users).map((x) => x.length),
    [3, 1],
  );
});
test("validation, pagination, money, injected clock and transitions", () => {
  assert.equal(r.validateUser(null).ok, false);
  assert.equal(r.validateUser({ id: "a", name: " A " }).value.name, "A");
  assert.deepEqual(r.page([1, 2, 3], { offset: 1, limit: 1 }).items, [2]);
  assert.throws(() => r.page([], { limit: 0 }));
  const state = { count: 1 };
  assert.deepEqual(r.transition(state, { type: "increment" }), { count: 2 });
  assert.equal(state.count, 1);
  assert.equal(r.totalCents([{ cents: 105, quantity: 3 }]), 315);
  assert.throws(() => r.totalCents([{ cents: 0.1, quantity: 1 }]));
  assert.deepEqual(r.settings({ PORT: "8080" }), { port: 8080, debug: false });
  assert.throws(() => r.settings({ PORT: "wat" }));
  assert.deepEqual(
    r.withTimestamp({ id: "a" }, () => 42),
    { id: "a", updatedAt: 42 },
  );
});
test("bounded retry preserves terminal errors and uses injected delay", async () => {
  const delays = [];
  let calls = 0;
  assert.equal(
    await retry(
      async () => {
        if (++calls < 3)
          throw Object.assign(new Error("busy"), { retryable: true });
        return 9;
      },
      { sleep: async (ms) => delays.push(ms) },
    ),
    9,
  );
  assert.deepEqual(delays, [100, 200]);
  let fatal = 0;
  await assert.rejects(
    retry(
      async () => {
        fatal++;
        throw Error("invalid");
      },
      { sleep: async () => {} },
    ),
  );
  assert.equal(fatal, 1);
});
test("bounded concurrency preserves order", async () => {
  let active = 0,
    peak = 0;
  const result = await mapConcurrent([1, 2, 3, 4], 2, async (value) => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve(); // let the other worker start
    active--;
    return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8]);
  assert.equal(peak, 2);
  await assert.rejects(mapConcurrent([1], 0, async (x) => x));
});
test("atomic JSON replaces a complete file", async () => {
  const folder = await mkdtemp(join(tmpdir(), "coding-core-"));
  try {
    const file = join(folder, "data.json");
    await writeJsonAtomic(file, { a: 1 });
    await writeJsonAtomic(file, { a: 2 });
    assert.deepEqual(JSON.parse(await readFile(file, "utf8")), { a: 2 });
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
test("transition table guards, refuses and never mutates", async () => {
  const states = await import("../js/task-states.mjs");
  const table = states.taskTransitions;
  assert.equal(Object.isFrozen(table.pending.start), true);
  const context = { evidence: [{ kind: "receipt", ref: "op_1" }] };
  const before = structuredClone(context);
  assert.equal(
    states.transition(table, "in_progress", "verify", context).to,
    "done",
  );
  assert.deepEqual(context, before);
  assert.match(
    states.transition(table, "done", "verify", context).error,
    /allowed: reopen/,
  );
  assert.match(
    states.transition(table, "nowhere", "start").error,
    /Unknown state/,
  );
  assert.match(
    states.transition(table, "pending", "block", { reason: " " }).error,
    /reason is required/,
  );
  assert.deepEqual(
    states.allowedEvents(table, "pending", { blockedBy: ["a"] }),
    ["cancel"],
  );
  assert.throws(
    () => states.defineTransitions({ a: { go: { to: "a", guard: "yes" } } }),
    /not a function/,
  );
  const final = states.defineTransitions({
    open: { close: { to: "closed" } },
    closed: {},
  });
  assert.equal(
    states.transition(final, "closed", "open").error,
    "Cannot open from closed (final state)",
  );
});
test("sqlite transactions nest with savepoints and migrations stop at a failure", async () => {
  const { openDatabase, transaction, migrate } =
    await import("../js/sqlite.mjs");
  const db = openDatabase(":memory:");
  db.exec("CREATE TABLE t (v TEXT)");
  transaction(db, () => {
    db.prepare("INSERT INTO t VALUES ('outer')").run();
    assert.throws(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO t VALUES ('inner')").run();
        throw new Error("inner");
      }),
    );
  });
  assert.deepEqual(
    db
      .prepare("SELECT v FROM t")
      .all()
      .map((r) => r.v),
    ["outer"],
  );
  const fresh = openDatabase(":memory:");
  assert.throws(() =>
    migrate(fresh, ["CREATE TABLE a (x)", "CREATE TABLE broken ("]),
  );
  assert.equal(fresh.prepare("PRAGMA user_version").get().user_version, 1);
  assert.throws(
    () => openDatabase(":memory:", { busyTimeoutMs: -1 }),
    RangeError,
  );
});
test("receipts keep the first settlement and refuse a pending once", async () => {
  const { openDatabase } = await import("../js/sqlite.mjs");
  const { createReceipts, operationKey } = await import("../js/receipts.mjs");
  const db = openDatabase(":memory:");
  const receipts = createReceipts(db, { now: () => "t" });
  assert.notEqual(operationKey("a", 1), operationKey("a", "1"));
  assert.throws(() => operationKey(), TypeError);
  receipts.reserve("k", "external");
  assert.throws(
    () => receipts.once("k", "external", () => 1),
    /pending: reconcile/,
  );
  receipts.settle("k", { n: 1 });
  assert.deepEqual(receipts.settle("k", { n: 2 }).result, { n: 1 });
  assert.equal(receipts.settle("k", { n: 2 }).replayed, true);
  assert.throws(() => receipts.settle("missing", {}), /No reservation/);
});
