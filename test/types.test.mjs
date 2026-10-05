import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { staticProblems, symptomLines } from "../src/runner.mjs";
import { TYPES, eligibleTypes, pickType } from "../src/types.mjs";

const EX = join(import.meta.dirname, "..", "examples", "types");

test("levels and the second-language rule decide which types are available", () => {
  assert.deepEqual(eligibleTypes(1), ["implement", "fix-the-bug", "refactor", "extend", "write-the-tests", "trace"]);
  assert.ok(!eligibleTypes(2).includes("port"), "port needs a second language");
  assert.ok(eligibleTypes(2, { canPort: true }).includes("port"));
  assert.ok(eligibleTypes(3, { canPort: true }).includes("optimize") && eligibleTypes(3).includes("debug-from-symptom"));
});

test("implement keeps at least half of the weight at every level", () => {
  for (const level of [1, 2, 3, 10]) {
    const types = eligibleTypes(level, { canPort: true });
    const total = types.reduce((n, t) => n + TYPES[t].weight, 0);
    assert.ok(TYPES.implement.weight / total >= 0.5, `level ${level}`);
  }
});

test("the weighted pick converges to the weights and starts with implement", () => {
  const events = [];
  const counts = {};
  for (let i = 0; i < 200; i++) {
    const t = pickType(events, "py", 3, { canPort: true });
    counts[t] = (counts[t] ?? 0) + 1;
    events.push({ type: "generated", lang: "py", challengeType: t });
  }
  assert.equal(pickType([], "py", 1), "implement");
  assert.ok(counts.implement >= 100, JSON.stringify(counts));
  for (const t of eligibleTypes(3, { canPort: true })) assert.ok(counts[t] > 0, `${t} appears`);
  assert.equal(pickType([{ type: "generated", lang: "py" }], "py", 1) !== undefined, true, "old events count as implement");
});

test("symptomLines reads the fenced block under ## Symptom", () => {
  const readme = "# T\n\n## Problem\nx\n\n## Symptom\n\nText.\n\n```\n{\"ERROR\":2}\n\n  second line  \n```\n\n## Examples\n```\nnot this\n```\n";
  assert.deepEqual(symptomLines(readme), ['{"ERROR":2}', "second line"]);
  assert.deepEqual(symptomLines("## Problem\nnone"), []);
});

test("the type examples satisfy their type-specific static rules", () => {
  for (const t of ["write-the-tests", "trace", "port", "debug-from-symptom", "optimize"]) {
    assert.deepEqual(staticProblems(join(EX, t)), [], t);
  }
});
