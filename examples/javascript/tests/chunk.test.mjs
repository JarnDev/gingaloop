import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { chunk } = await import(`../${process.env.TARGET ?? "starter"}/solution.mjs`);

test("splits into chunks of the given size", () => {
  assert.deepEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
});

test("keeps the last partial chunk", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]], "leftover items form a smaller final chunk");
});

test("empty input gives no chunks", () => {
  assert.deepEqual(chunk([], 3), []);
});

test("size larger than the array gives one chunk", () => {
  assert.deepEqual(chunk(["a", "b"], 5), [["a", "b"]]);
});

test("does not mutate the input array", () => {
  const items = [1, 2, 3];
  const result = chunk(items, 2);
  assert.deepEqual(items, [1, 2, 3], "callers reuse the input; chunk must copy, not splice");
  result[0][0] = 99;
  assert.equal(items[0], 1, "the chunks must be new arrays, not views of the input");
});

test("rejects a non-positive or non-integer size", () => {
  for (const bad of [0, -1, 1.5, NaN]) {
    assert.throws(() => chunk([1, 2], bad), { name: "RangeError", message: `size must be a positive integer, got ${bad}` },
      `size ${bad} must throw the RangeError from the README (and not loop forever)`);
  }
});

test("golden cases", () => {
  const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
  for (const { items, size, expected } of cases) {
    assert.deepEqual(chunk(items, size), expected, `chunk(${JSON.stringify(items)}, ${size})`);
  }
});

test("handles a million items quickly", () => {
  const items = Array.from({ length: 1_000_000 }, (_, i) => i);
  const start = performance.now();
  const result = chunk(items, 1000);
  assert.equal(result.length, 1000);
  assert.ok(performance.now() - start < 3000, "should be linear time");
});
