import assert from "node:assert/strict";
import { test } from "node:test";
import { stillNeeded, table } from "../src/cli.mjs";
import { paceLabel } from "../src/pace.mjs";

test("table pads columns to the widest cell and right-aligns numbers", () => {
  const out = table(["Lang", "Solved"], [["TypeScript", "3"], ["C", "12"]], ["left", "right"]).split("\n");
  assert.deepEqual(out, ["Lang        Solved", "──────────  ──────", "TypeScript       3", "C               12"]);
});

test("still needed: points, at most 3 areas with a count of the rest, clean streak", () => {
  const s = { needed: 330, gates: { areasMissing: ["a", "b", "c", "d"], streak: 1, streakNeeded: 3 } };
  assert.equal(stillNeeded(s), "330 pts · areas: a, b, c (+1) · clean streak 1/3");
  assert.equal(stillNeeded({ needed: 0, gates: { areasMissing: [], streak: 3, streakNeeded: 3 } }), "points done");
  assert.match(stillNeeded({ needed: 0, gates: { promotionPending: true } }), /promotion challenge next/);
});

test("pace label marks the overall fallback", () => {
  assert.equal(paceLabel({ basis: "lang", factor: 2.1 }), "×2.1");
  assert.equal(paceLabel({ basis: "all", factor: 1.75 }), "×1.75*");
  assert.equal(paceLabel({ basis: null, factor: 1 }), "–");
});
