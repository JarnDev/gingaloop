import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Runs the program and compares its output with ../$TARGET/answer.txt line by line.
// It never prints the real output: that would give the answer away.
const run = spawnSync(process.execPath, ["../program/main.mjs"], { encoding: "utf8", timeout: 10000 });
const actual = run.stdout.replace(/\s+$/, "").split("\n").map((l) => l.trimEnd());
const answer = readFileSync(`../${process.env.TARGET ?? "starter"}/answer.txt`, "utf8").replace(/\s+$/, "").split("\n").map((l) => l.trimEnd());

test("the program ran", () => assert.equal(run.status, 0, "the program itself must run cleanly"));

test("same number of lines", () => {
  assert.ok(answer.length === actual.length, `your answer has ${answer.length} line(s); the program prints ${actual.length}`);
});

for (let n = 1; n <= actual.length; n++) {
  test(`line ${n} matches`, () => {
    assert.ok(answer[n - 1] === actual[n - 1], `line ${n} of your answer is not what the program prints`);
  });
}
