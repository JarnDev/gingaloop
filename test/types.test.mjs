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

test("port: the source must be readable at the challenge's level, preferring another family", async () => {
  const { choosePortSource } = await import("../src/types.mjs");
  const L = (id, level) => ({ id, level });
  // Node.js is the strongest, but same family as TypeScript: Python wins (3 >= 2 - 1).
  assert.equal(choosePortSource("typescript", [L("nodejs", 5), L("python", 3), L("c", 2)], 2), "python");
  // Only same-family languages qualify: fall back to them.
  assert.equal(choosePortSource("typescript", [L("nodejs", 3), L("python", 1)], 2), "nodejs");
  // Nothing at the floor (L2): no port.
  assert.equal(choosePortSource("python", [L("c", 1), L("javascript", 1)], 2), null);
  // Below port's minimum challenge level: no port.
  assert.equal(choosePortSource("python", [L("c", 9)], 1), null);
  // SQL and React are never source or target.
  assert.equal(choosePortSource("python", [L("sql", 9), L("react", 9)], 3), null);
  assert.equal(choosePortSource("sql", [L("python", 9)], 3), null);
  // Ties: higher level, then id. Unknown languages are their own family.
  assert.equal(choosePortSource("python", [L("cpp", 4), L("c", 4), L("javascript", 3)], 3), "c");
  assert.equal(choosePortSource("go", [L("rust", 2), L("go", 9)], 2), "rust");
});

test("port: the source may be at most one level below the challenge (the table from the design)", async () => {
  const { choosePortSource } = await import("../src/types.mjs");
  const src = (pyLevel, challenge) => choosePortSource("typescript", [{ id: "python", level: pyLevel }], challenge);
  assert.equal(src(2, 2), "python", "TS L2 + Python L2: L2 port");
  assert.equal(src(2, 5), null, "TS L5 + Python L2: no port at L5…");
  assert.equal(src(2, 4), null, "…nor at L4 (the most it may drop)");
  assert.equal(src(4, 5), "python", "TS L5 + Python L4: L5 port");
  assert.equal(src(3, 5), null, "TS L5 + Python L3: not at L5…");
  assert.equal(src(3, 4), "python", "…but at L4 (one level lower)");
});

test("port drops at most one level when the source can't be read at the target's level", async () => {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { chooseType } = await import("../src/cli.mjs");
  const { findProfile } = await import("../src/profiles.mjs");
  const ws = mkdtempSync(join(tmpdir(), "gingaloop-port-"));
  try {
    // Tiny ladder: 100 points per level, so 4 clean solves = L5 and 2 = L3.
    const config = { rotation: ["typescript", "python"], leveling: { thresholds: [100, 200, 300, 400], basePoints: 100, belowShare: [0.3, 0.05], hintMultiplier: [1, 0.85, 0.7, 0.5] } };
    writeFileSync(join(ws, "gingaloop.json"), JSON.stringify(config));
    const solves = (lang, n) => Array.from({ length: n }, (_, i) => ({ type: "solved", id: `${lang}${i}`, lang, level: i + 1, hints: 0 }));
    const events = [...solves("typescript", 4), ...solves("python", 2)]; // TS L5, Python L3
    const ts = findProfile(null, "typescript");
    assert.deepEqual(chooseType(ws, config, events, ts, 5, "port"), { type: "port", sourceLang: "python", level: 4 }, "drops to L4");
    assert.throws(() => chooseType(ws, config, events, ts, 5, "port", { levelExplicit: true }), /needs another rotation language .* at level 4\+/);
    const few = [...solves("typescript", 4), ...solves("python", 1)]; // Python L2: not even L4 works
    assert.throws(() => chooseType(ws, config, few, ts, 5, "port"), /port/);
    assert.deepEqual(chooseType(ws, config, events, ts, 3, "trace"), { type: "trace", sourceLang: null, level: 3 });
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
});
