/** Pure data recipes. All collections return new values; callers own side effects. */
import fp from "../vendor/lodash/fp.js";

export const normalizeUsers = fp.flow(
  fp.map((user) => ({
    ...user,
    name: user.name.trim(),
    email: user.email.trim().toLowerCase(),
  })),
  fp.filter((user) => user.active === true),
  fp.uniqBy("id"),
  fp.sortBy(["name", "id"]),
);
export const totalsByCustomer = fp.flow(
  fp.groupBy("customer"),
  fp.mapValues(fp.sumBy("cents")),
);
export const indexById = fp.keyBy("id");
export const partitionByActive = fp.partition({ active: true });

/** @param {unknown} input */
export function validateUser(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { ok: false, errors: ["Expected a user object"] };
  const value = /** @type {Record<string, unknown>} */ (input);
  const errors = [];
  if (typeof value.id !== "string" || !/^[a-z][a-z0-9-]{0,39}$/.test(value.id))
    errors.push("id must be a lowercase slug");
  if (typeof value.name !== "string" || !value.name.trim())
    errors.push("name is required");
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: { id: value.id, name: value.name.trim() } };
}

export function page(items, { offset = 0, limit = 20 } = {}) {
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new RangeError("offset >= 0; limit 1..100");
  return {
    items: fp.slice(offset, offset + limit, items),
    total: items.length,
    offset,
    limit,
  };
}

export function transition(state, event) {
  switch (event.type) {
    case "increment":
      return { ...state, count: state.count + 1 };
    case "reset":
      return { ...state, count: 0 };
    default:
      return state;
  }
}

/** Integer minor units avoid accidental floating-point currency arithmetic. */
export function totalCents(lines) {
  if (
    !lines.every(
      (line) =>
        Number.isSafeInteger(line.cents) &&
        line.cents >= 0 &&
        Number.isSafeInteger(line.quantity) &&
        line.quantity >= 0,
    )
  )
    throw new RangeError("Use nonnegative safe integer cents and quantities");
  const total = fp.sumBy((line) => line.cents * line.quantity, lines);
  if (!Number.isSafeInteger(total))
    throw new RangeError("Total exceeds safe integer range");
  return total;
}

export function settings(environment) {
  const port = Number(environment.PORT ?? "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new RangeError("PORT must be 1..65535");
  return { port, debug: environment.DEBUG === "1" };
}

export function withTimestamp(record, now) {
  return { ...record, updatedAt: now() };
}
