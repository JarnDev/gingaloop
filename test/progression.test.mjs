import assert from "node:assert/strict";
import { test } from "node:test";
import { dueReview, isStruggle } from "../src/cli.mjs";
import { isClean, levelState } from "../src/levels.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const L = DEFAULT_CONFIG.leveling;
const AREAS = ["strings", "arrays", "hashing", "math-bits"];
const gate = { areasAt: () => AREAS, cleanStreak: 3, since: "2026-10-05T15:00:00.000Z" };
let n = 0;
// A generated + solved pair after the gates date, in a given area.
const solve = (area, { hints = 0, level = 1, afterGiveup = false } = {}) => {
  const id = `c${n++}`;
  const ts = `2026-10-06T10:${String(n % 60).padStart(2, "0")}:00.000Z`;
  return [
    { type: "generated", id, lang: "py", level, area, ts },
    { type: "solved", id, lang: "py", level, hints, afterGiveup, ts },
  ];
};

test("clean = at most one hint and not after giving up", () => {
  assert.ok(isClean({ hints: 0 }) && isClean({ hints: 1 }));
  assert.ok(!isClean({ hints: 2 }) && !isClean({ hints: 0, afterGiveup: true }));
});

test("points alone no longer level up: every area needs a clean solve", () => {
  const events = [...solve("strings"), ...solve("strings"), ...solve("strings"), ...solve("arrays"), ...solve("arrays"), ...solve("hashing")];
  const s = levelState(events, "py", L, gate);
  assert.equal(s.points, 600);
  assert.equal(s.level, 1, "600 points, but math-bits was never solved");
  assert.deepEqual(s.gates.areasMissing, ["math-bits"]);
  assert.equal(s.gates.blocked, true);
  assert.equal(levelState([...events, ...solve("math-bits")], "py", L, gate).level, 2);
});

test("the last 3 solves at the level must be clean", () => {
  const covered = [...solve("strings"), ...solve("arrays"), ...solve("hashing"), ...solve("math-bits"), ...solve("strings"), ...solve("arrays")];
  assert.equal(levelState(covered, "py", L, gate).level, 2, "baseline: 600 pts, all areas, 3 clean in a row");
  const struggled = [...covered.slice(0, 10), ...solve("arrays", { hints: 3 }), ...solve("hashing", { hints: 1 })];
  const s = levelState(struggled, "py", L, gate);
  assert.equal(s.level, 1, "the 3-hint solve breaks the clean streak");
  assert.equal(s.gates.streak, 1);
  const recovered = [...struggled, ...solve("strings"), ...solve("arrays")];
  assert.equal(levelState(recovered, "py", L, gate).level, 2, "three clean in a row again");
});

test("levels earned before the gates existed are kept (no demotions)", () => {
  const old = Array.from({ length: 6 }, (_, i) => [
    { type: "generated", id: `o${i}`, lang: "py", level: 1, ts: "2026-10-01T10:00:00.000Z" },
    { type: "solved", id: `o${i}`, lang: "py", level: 1, hints: 3, ts: "2026-10-01T10:00:00.000Z" },
  ]).flat();
  const pointsOnly = levelState(old, "py", { ...L, thresholds: [300, 1500] });
  assert.equal(pointsOnly.level, 2);
  assert.equal(levelState(old, "py", { ...L, thresholds: [300, 1500] }, gate).level, 2, "kept even with no areas and 3-hint solves");
});

test("without a gate (old callers), points alone decide, as before", () => {
  const events = [...solve("strings"), ...solve("strings"), ...solve("strings"), ...solve("strings"), ...solve("strings"), ...solve("strings")];
  assert.equal(levelState(events, "py", L).level, 2);
});

test("struggled solves come back for review at 3, 7 and 21 days", () => {
  const gen = { type: "generated", id: "x", lang: "py", level: 1, title: "X", estMinutes: 20, date: "2026-10-01", ts: "2026-10-01T08:00:00Z" };
  const hinted = { type: "solved", id: "x", lang: "py", level: 1, hints: 2, date: "2026-10-01", ts: "2026-10-01T20:00:00Z" };
  assert.ok(isStruggle(hinted, gen));
  assert.ok(isStruggle({ ...hinted, hints: 0, minutes: 41 }, gen), "more than twice the estimate");
  assert.ok(!isStruggle({ ...hinted, hints: 1, minutes: 40 }, gen));
  assert.equal(dueReview([gen, hinted], [3, 7, 21], "2026-10-03"), null);
  assert.equal(dueReview([gen, hinted], [3, 7, 21], "2026-10-04")?.id, "x");
  const r1 = { type: "generated", id: "r1", reviewOf: "x", date: "2026-10-04", ts: "2026-10-04T08:00:00Z" };
  const r2 = { ...r1, id: "r2", date: "2026-10-08" };
  assert.equal(dueReview([gen, hinted, r1, r2], [3, 7, 21], "2026-10-21"), null);
  assert.equal(dueReview([gen, hinted, r1, r2], [3, 7, 21], "2026-10-22")?.id, "x", "third review at day 21");
  assert.equal(dueReview([gen, { ...hinted, hints: 0, minutes: 10 }], [3, 7, 21], "2026-10-04"), null, "a clean solve doesn't come back");
});

test("promotion: gates met → pending; a clean promotion solve unlocks; a failure waits 3 days", async () => {
  const { promotionAreas, promotionDue } = await import("../src/progression.mjs");
  const g = { ...gate, promotion: true, promotionRetryDays: 3 };
  const base = [...solve("strings"), ...solve("arrays"), ...solve("hashing"), ...solve("math-bits"), ...solve("strings"), ...solve("arrays")];
  const s = levelState(base, "py", L, g);
  assert.equal(s.level, 1, "points + gates are not enough on their own");
  assert.equal(s.gates.promotionPending, true);
  assert.equal(promotionDue(s, base, "py", "2026-10-06", new Set()), true);

  const promo = (id, solvedExtra, date = "2026-10-07") => [
    { type: "generated", id, lang: "py", level: 1, area: "hashing", promotion: true, ts: `${date}T08:00:00Z` },
    { type: "solved", id, lang: "py", level: 1, promotion: true, date, ts: `${date}T20:00:00Z`, ...solvedExtra },
  ];
  assert.equal(levelState([...base, ...promo("p1", { hints: 1 })], "py", L, g).level, 2, "clean promotion: level up");

  const failed = levelState([...base, ...promo("p1", { hints: 3 })], "py", L, g);
  assert.equal(failed.level, 1);
  assert.equal(failed.gates.promotionRetryOn, "2026-10-10");
  assert.equal(promotionDue(failed, base, "py", "2026-10-09", new Set()), false, "cool-down");
  assert.equal(promotionDue(failed, base, "py", "2026-10-10", new Set()), true);

  const gaveUp = [...base, { type: "generated", id: "p2", lang: "py", level: 1, promotion: true, ts: "2026-10-07T08:00:00Z" },
    { type: "gaveup", id: "p2", lang: "py", level: 1, promotion: true, date: "2026-10-07", ts: "2026-10-07T21:00:00Z" }];
  assert.equal(levelState(gaveUp, "py", L, g).gates.promotionRetryOn, "2026-10-10");

  const withOpen = [...base, { type: "generated", id: "p3", lang: "py", level: 1, promotion: true }];
  assert.equal(promotionDue(s, withOpen, "py", "2026-10-06", new Set(["p3"])), false, "one open promotion at a time");

  assert.deepEqual(promotionAreas(base, "py", 1), ["hashing", "math-bits", "strings"], "least recently practiced first");
});
