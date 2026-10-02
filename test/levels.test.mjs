import assert from "node:assert/strict";
import { test } from "node:test";
import { levelState, pointsFor, resolveLevel, streakState } from "../src/levels.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const L = DEFAULT_CONFIG.leveling;
let n = 0;
const solved = (lang, level, extra = {}) => ({ type: "solved", lang, level, id: `c${n++}`, hints: 0, ...extra });
const many = (count, lang, level, extra) => Array.from({ length: count }, () => solved(lang, level, extra));

test("default ladder has 10 levels", () => {
  assert.deepEqual(levelState([], "c", L), { level: 1, points: 0, nextAt: 600, needed: 600, max: 10 });
});

test("points: full at your level, small below, scaled by hints, zero after giving up", () => {
  assert.equal(pointsFor({ level: 3 }, 3, L), 100);
  assert.equal(pointsFor({ level: 2 }, 3, L), 30);
  assert.equal(pointsFor({ level: 1 }, 3, L), 5);
  assert.equal(pointsFor({ level: 1 }, 9, L), 5, "anything 2+ below earns the floor share");
  assert.deepEqual([0, 1, 2, 3, 7].map((h) => pointsFor({ level: 1, hints: h }, 1, L)), [100, 85, 70, 50, 50]);
  assert.equal(pointsFor({ level: 2, hints: 1 }, 3, L), 26, "below-level and hint penalties combine");
  assert.equal(pointsFor({ level: 1, afterGiveup: true }, 1, L), 0);
});

test("six clean solves at level 1 unlock level 2", () => {
  assert.equal(levelState(many(5, "c", 1), "c", L).level, 1);
  const s = levelState(many(6, "c", 1), "c", L);
  assert.equal(s.level, 2);
  assert.equal(s.points, 600);
  assert.equal(s.needed, 900);
});

test("farming below your level is much slower than playing at it", () => {
  // Reach L3 (1500 pts), then compare ways to earn the 1500 more needed for L4.
  const toL3 = [...many(6, "c", 1), ...many(9, "c", 2)];
  assert.equal(levelState(toL3, "c", L).level, 3);
  const play = levelState([...toL3, ...many(15, "c", 3)], "c", L);
  assert.equal(play.level, 4, "15 solves at your level");
  const oneBelow = levelState([...toL3, ...many(49, "c", 2)], "c", L);
  assert.equal(oneBelow.level, 3, "one level below: 30 pts each, so 49 solves (1470) aren't enough");
  const twoBelow = levelState([...toL3, ...many(100, "c", 1)], "c", L);
  assert.equal(twoBelow.points, 1500 + 500, "two+ below: 5 pts each, 100 solves earn only 500");
});

test("each solve is scored with the level the user had at that moment", () => {
  // 6 L1 solves → L2; then an L1 solve is now 1 below (30), not 100.
  const s = levelState([...many(6, "c", 1), solved("c", 1)], "c", L);
  assert.equal(s.points, 630);
});

test("give-ups, other languages and duplicate solves never count", () => {
  const dup = solved("c", 1);
  const events = [
    ...many(6, "python", 1), dup, dup, dup,
    { type: "gaveup", lang: "c", level: 1, id: "g1" },
    { type: "hint", lang: "c", level: 1, id: "h1" },
  ];
  assert.equal(levelState(events, "c", L).points, 100);
  assert.equal(levelState(events, "python", L).level, 2);
});

test("caps at the max level", () => {
  const s = levelState(many(2000, "go", 1), "go", { ...L, thresholds: [100, 200] });
  assert.equal(s.level, 3);
  assert.equal(s.nextAt, null);
  assert.equal(s.needed, 0);
});

test("resolveLevel: default is the earned level, lower is allowed, higher is refused", () => {
  const state = { level: 2, points: 820, nextAt: 1500, needed: 680, max: 10 };
  assert.equal(resolveLevel(undefined, state, "c", L), 2);
  assert.equal(resolveLevel("1", state, "c", L), 1);
  assert.throws(() => resolveLevel(3, state, "c", L), /Level 3 is locked for c\. You are level 2 with 820 points; level 3 needs 680 more \(about 7 hint-free level-2 solves\)/);
  assert.throws(() => resolveLevel(0, state, "c", L), /between 1 and 10/);
  assert.throws(() => resolveLevel(11, state, "c", L), /between 1 and 10/);
});

const days = (from, count) =>
  Array.from({ length: count }, (_, i) => new Date(Date.parse(from + "T12:00:00Z") + i * 86_400_000).toISOString().slice(0, 10));

test("streak: consecutive solve days; today unfinished doesn't break it", () => {
  assert.deepEqual(streakState([], "2026-10-01"), { days: 0, freezes: 0, frozeOn: [] });
  assert.equal(streakState(days("2026-09-28", 3), "2026-09-30").days, 3);
  assert.equal(streakState(days("2026-09-28", 3), "2026-10-01").days, 3);
  assert.equal(streakState(days("2026-09-28", 3), "2026-10-02").days, 0, "a missed day without a freeze breaks it");
});

test("streak: 7 solve days earn a freeze that covers one missed day", () => {
  const week = days("2026-09-01", 7); // 09-01 .. 09-07
  assert.equal(streakState(week, "2026-09-07").freezes, 1);
  const after = streakState([...week, "2026-09-09"], "2026-09-09"); // missed 09-08
  assert.deepEqual(after, { days: 8, freezes: 0, frozeOn: ["2026-09-08"] });
  const twoMissed = streakState([...week, "2026-09-10"], "2026-09-10"); // missed 08 and 09, one freeze
  assert.equal(twoMissed.days, 1);
});

test("streak: at most 2 freezes are held", () => {
  assert.equal(streakState(days("2026-01-01", 35), "2026-02-04").freezes, 2);
});
