import assert from "node:assert/strict";
import { test } from "node:test";
import { dailyPlan } from "../src/cli.mjs";
import { band, isStruggle, paceFor, paceReport, solvePace } from "../src/pace.mjs";
import { dueReview, openReview, reviewCycles, reviewSummary } from "../src/reviews.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const day = (d) => new Date(Date.UTC(2026, 9, d, 12)).toISOString().slice(0, 10); // day(32) is Nov 1
const gen = (id, lang, d, est, extra = {}) => ({ type: "generated", id, lang, level: 1, title: id, estMinutes: est, source: "daily", date: day(d), ts: `${day(d)}T08:00:00Z`, ...extra });
const solved = (id, lang, d, minutes, hints = 0, extra = {}) => ({ type: "solved", id, lang, level: 1, minutes, hints, date: day(d), ts: `${day(d)}T20:00:00Z`, ...extra });

// A real first two weeks: Claude estimates ~20 min, this user usually takes 1.3–2.2× that.
const history = [
  gen("ts1", "typescript", 6, 20), solved("ts1", "typescript", 6, 45),
  gen("node1", "nodejs", 7, 15), solved("node1", "nodejs", 7, 20),
  gen("c1", "c", 8, 20), solved("c1", "c", 8, 122, 2),
  gen("node2", "nodejs", 8, 20, { source: "manual" }), solved("node2", "nodejs", 8, 18),
  gen("ts2", "typescript", 9, 20, { reviewOf: "ts1" }), solved("ts2", "typescript", 9, 42),
  gen("cpp1", "cpp", 10, 20), solved("cpp1", "cpp", 10, 21),
  gen("c2", "c", 11, 20, { reviewOf: "c1" }), solved("c2", "c", 11, 35),
  gen("ts3", "typescript", 12, 20, { reviewOf: "ts2" }), solved("ts3", "typescript", 12, 42),
];

test("pace: median of your clean solves, per language once there are 3, calibrated after 5", () => {
  assert.deepEqual(paceFor([], "c"), { factor: 1, basis: null, solves: 0, calibrated: false });
  const p = paceFor(history, "typescript");
  assert.equal(p.basis, "lang");
  assert.equal(p.factor, 2.1, "ts: 45/20, 42/20, 42/20");
  assert.equal(p.calibrated, true);
  const c = paceFor(history, "c");
  assert.equal(c.basis, "all", "c has a single clean solve: the overall pace is used");
  assert.equal(c.solves, 7, "hinted solves don't say anything about your normal pace");
});

test("bands: ± tolerance is on pace; over the struggle line only counts once calibrated", () => {
  assert.equal(band(14, 20, true), "faster");
  assert.equal(band(15, 20, true), "on pace", "-25% is still inside the band");
  assert.equal(band(22, 20, true), "on pace");
  assert.equal(band(25, 20, true), "on pace", "+25% is still inside the band");
  assert.equal(band(28, 20, true), "slower");
  assert.equal(band(31, 20, true), "struggle");
  assert.equal(band(31, 20, false), "slower", "uncalibrated: never a struggle by time");
  assert.equal(band(22, 20, true, { tolerance: 0.1 }), "on pace");
  assert.equal(band(23, 20, true, { tolerance: 0.1 }), "slower", "a tighter band is just a setting");
});

test("on the real history only the 2-hint C solve is a struggle", () => {
  const struggles = history.filter((e) => e.type === "solved" && isStruggle(history, e)).map((e) => e.id);
  assert.deepEqual(struggles, ["c1"]);
  const hop = solvePace(history, history.at(-1));
  assert.equal(hop.band, "slower");
  assert.equal(hop.expected, 31, "20 min × pace 1.54 (all languages: ts had only 2 clean solves before)");
  assert.equal(hop.pct, 35);
});

test("a stored pace wins over recomputing (history doesn't shift)", () => {
  const e = { ...history.at(-1), pace: 1, paceCalibrated: true };
  const p = solvePace([...history.slice(0, -1), e], e);
  assert.equal(p.expected, 20);
  assert.equal(p.band, "struggle");
});

test("the done report shows expected, took, the difference and the verdict", () => {
  const out = paceReport(solvePace(history, history.at(-1)));
  assert.match(out, /expected +31 min +\(estimate 20 × your pace 1\.54\)/);
  assert.match(out, /took +42 min +\+11 min \(\+35%\)/);
  assert.match(out, /┆ on pace ±25% {2}╎ struggle \+50%/);
  assert.match(out, /slower than usual \(no review\)/);
});

const days = [3, 7, 21];
const hinted = (id, d, extra) => solved(id, "c", d, 30, 2, extra);
const base = [gen("x", "c", 1, 20), hinted("x", 1)];
const review = (id, d, of = "x") => gen(id, "c", d, 20, { reviewOf: of });

test("cycle: 3/7/21 from the struggle; clean reviews leave it as planned", () => {
  assert.equal(dueReview(base, days, day(3)), null);
  assert.equal(dueReview(base, days, day(4))?.id, "x");
  const ev = [...base, review("r1", 4), solved("r1", "c", 4, 20), review("r2", 8), solved("r2", "c", 8, 20)];
  assert.deepEqual(reviewCycles(ev, days, day(9))[0].steps, [3, 7, 21]);
  assert.equal(dueReview(ev, days, day(21)), null);
  assert.equal(dueReview(ev, days, day(22))?.id, "x");
});

test("cycle: struggling with a review extends the same cycle (3/7/21 → 3/7/21/35), no second chain", () => {
  const ev = [...base, review("r1", 4), hinted("r1", 4), review("r2", 8), solved("r2", "c", 8, 20), review("r3", 22), solved("r3", "c", 22, 20)];
  const cycles = reviewCycles(ev, days, day(23));
  assert.equal(cycles.length, 1, "the review's struggle joins the original's cycle");
  assert.deepEqual(cycles[0].steps, [3, 7, 21, 35]);
  assert.equal(dueReview(ev, days, day(35)), null);
  assert.equal(dueReview(ev, days, day(36))?.id, "x", "the extra step, reviewing the ORIGINAL topic");
  const gaveUpAgain = [...ev, review("r4", 36), { type: "gaveup", id: "r4", lang: "c", level: 1, date: day(36), ts: `${day(36)}T20:00:00Z` }];
  assert.deepEqual(reviewCycles(gaveUpAgain, days, day(37))[0].steps, [3, 7, 21, 35, 49], "a give-up extends too");
});

test("a review of a review points back to the original", () => {
  const ev = [...base, review("r1", 4), hinted("r1", 4), review("r2", 8, "r1"), hinted("r2", 8)];
  const [c] = reviewCycles(ev, days, day(9));
  assert.equal(c.root, "x");
  assert.deepEqual(c.steps, [3, 7, 21, 35, 49]);
  assert.equal(c.done, 2);
});

test("on the real history: the C cycle continues, the TypeScript chain is gone", () => {
  const cycles = reviewCycles(history, days, day(13));
  assert.deepEqual(cycles.map((c) => [c.root, c.steps, c.done]), [["c1", [3, 7, 21], 1]]);
  assert.equal(dueReview(history, days, day(14)), null);
  assert.equal(dueReview(history, days, day(15))?.id, "c1", "the day-7 C review");
});

test("daily plan: the rotation always runs; a due review comes as an extra, one open at a time", () => {
  const config = DEFAULT_CONFIG;
  const plan = dailyPlan(history, config, day(15));
  assert.equal(plan.picks, 1);
  assert.equal(plan.review?.id, "c1");

  const withOpen = [...history, gen("ts4", "typescript", 13, 20, { reviewOf: "ts1" })];
  assert.equal(openReview(withOpen)?.id, "ts4");
  const waiting = dailyPlan(withOpen, config, day(15));
  assert.equal(waiting.picks, 1);
  assert.equal(waiting.review, null, "the open review goes first");
  assert.equal(waiting.waiting?.id, "c1");
  assert.match(reviewSummary(withOpen, config, day(15)), /Review open \(optional\): ts4/);

  const madeToday = [...history, gen("rot", "python", 15, 20), review("c3", 15, "c1")];
  const again = dailyPlan(madeToday, config, day(15));
  assert.deepEqual([again.picks, again.review], [0, null], "each once a day");
  assert.equal(dailyPlan(madeToday, config, day(15), { force: true }).forced, 1);
  assert.match(reviewSummary(history, config, day(14)), /Next review: c1 on 2026-10-15/);
});
