/** Side-effect recipes: inject the operation, sleeper and resources. */
import { writeFile, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export async function retry(
  operation,
  {
    attempts = 3,
    sleep,
    shouldRetry = (error) => error.retryable === true,
  } = {},
) {
  if (
    !Number.isInteger(attempts) ||
    attempts < 1 ||
    attempts > 5 ||
    typeof sleep !== "function"
  )
    throw new RangeError("attempts 1..5 and injected sleep required");
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      await sleep(Math.min(100 * 2 ** (attempt - 1), 1000));
    }
  }
}

export async function mapConcurrent(items, concurrency, operation) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16)
    throw new RangeError("concurrency must be 1..16");
  const results = new Array(items.length);
  let next = 0,
    failed = false;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!failed) {
        const index = next++;
        if (index >= items.length) return;
        try {
          results[index] = await operation(items[index], index);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    }),
  );
  return results;
}

/** Atomic replacement for one writer; does not coordinate concurrent writers. */
export async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      flag: "wx",
    });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}
