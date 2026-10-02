import assert from "node:assert/strict";
import { test } from "node:test";
import { dueReview, streak } from "../src/cli.mjs";
import { passed } from "../src/runner.mjs";

test("a give-up comes back exactly 3 and 7 days later, once per day", () => {
  const events = [
    { type: "generated", id: "x", lang: "c", level: 2, title: "Ring buffer", topics: ["arrays"], ts: "2026-10-01T08:00:00Z" },
    { type: "gaveup", id: "x", lang: "c", level: 2, date: "2026-10-01", ts: "2026-10-01T20:00:00Z" },
  ];
  assert.equal(dueReview(events, [3, 7], "2026-10-03"), null);
  const due = dueReview(events, [3, 7], "2026-10-04");
  assert.deepEqual(due, { id: "x", lang: "c", level: 2, title: "Ring buffer", topics: ["arrays"] });
  assert.ok(dueReview(events, [3, 7], "2026-10-08"));
  const reviewed = [...events, { type: "generated", id: "y", reviewOf: "x", ts: "2026-10-04T08:00:00Z" }];
  assert.equal(dueReview(reviewed, [3, 7], "2026-10-04"), null, "already reviewed today");
});

test("local date wins over the UTC timestamp (evening in UTC-3 is still today)", () => {
  const late = { type: "solved", date: "2026-10-01", ts: "2026-10-02T01:30:00Z" };
  assert.equal(streak([late], "2026-10-01").days, 1);
  const gen = { type: "generated", id: "y", reviewOf: "x", date: "2026-10-04", ts: "2026-10-05T01:00:00Z" };
  const gave = { type: "gaveup", id: "x", lang: "c", level: 1, date: "2026-10-01", ts: "2026-10-01T12:00:00Z" };
  assert.equal(dueReview([gave, gen], [3], "2026-10-04"), null);
});

test("pass detection: exit code, timeout and success pattern", () => {
  const m = { test: { successPattern: "ALL TESTS PASSED" } };
  assert.equal(passed({ code: 0, output: "ALL TESTS PASSED\n", timedOut: false }, m), true);
  assert.equal(passed({ code: 0, output: "[FAIL] x\n", timedOut: false }, m), false, "exit 0 without the pattern is a failure");
  assert.equal(passed({ code: 1, output: "ALL TESTS PASSED", timedOut: false }, m), false);
  assert.equal(passed({ code: null, output: "", timedOut: true }, {}), false);
  assert.equal(passed({ code: 0, output: "", timedOut: false }, {}), true);
});
