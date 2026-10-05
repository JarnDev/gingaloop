import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const { summarizeLog } = await import(`../${process.env.TARGET ?? "starter"}/solution.mjs`);

test("counts each level", () => {
  assert.deepEqual(summarizeLog(["ERROR disk full", "WARN slow", "ERROR retry failed"]), { ERROR: 2, WARN: 1 });
});

test("consecutive matching lines are all counted", () => {
  const lines = ["ERROR disk full", "ERROR disk full", "ERROR retry failed", "ERROR giving up"];
  assert.deepEqual(summarizeLog(lines), { ERROR: 4 }, "four valid lines in a row are four lines");
});

test("calling it twice gives the same result", () => {
  const lines = ["WARN a", "INFO b", "WARN c"];
  const first = summarizeLog(lines);
  assert.deepEqual(summarizeLog(lines), first, "no state may leak from one call to the next");
  assert.deepEqual(summarizeLog(["ERROR only"]), { ERROR: 1 });
});

test("any uppercase level is counted", () => {
  assert.deepEqual(summarizeLog(["AUDIT login ok", "SECURITY token reused"]), { AUDIT: 1, SECURITY: 1 });
});

test("lines without a message are skipped", () => {
  assert.deepEqual(summarizeLog(["ERROR", "ERROR ", "garbage", "error lowercase", "ERROR ok"]), { ERROR: 1 });
});

test("empty input gives an empty summary", () => {
  assert.deepEqual(summarizeLog([]), {});
});

test("golden cases", () => {
  const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
  for (const { lines, expected } of cases) assert.deepEqual(summarizeLog(lines), expected, JSON.stringify(lines));
});
