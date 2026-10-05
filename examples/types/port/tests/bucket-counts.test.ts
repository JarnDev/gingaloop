import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { bucketCounts } = await import(`../${process.env.TARGET ?? "starter"}/solution.ts`);

test("counts values per bucket, sorted by bucket", () => {
  assert.deepEqual(bucketCounts([0, 9, 10, 25, 3], 10), [[0, 3], [1, 1], [2, 1]]);
});

test("negative values floor toward minus infinity, like Python's //", () => {
  assert.deepEqual(bucketCounts([-1, -10, -11], 10), [[-2, 1], [-1, 2]], "-1 // 10 == -1 and -11 // 10 == -2 in Python");
});

test("buckets are sorted numerically, not as text", () => {
  assert.deepEqual(bucketCounts([20, -100, 100, -5], 10), [[-10, 1], [-1, 1], [2, 1], [10, 1]]);
});

test("empty input gives no buckets", () => {
  assert.deepEqual(bucketCounts([], 5), []);
});

test("size must be positive", () => {
  for (const size of [0, -3]) assert.throws(() => bucketCounts([1], size), { message: "size must be positive" });
});

test("golden cases (outputs from the Python source)", () => {
  const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
  for (const { values, size, expected } of cases) assert.deepEqual(bucketCounts(values, size), expected, `${JSON.stringify(values)} / ${size}`);
});
