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
