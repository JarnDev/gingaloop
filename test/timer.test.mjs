import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fillNotes, noteValues, notesTemplate } from "../src/notes.mjs";
import { timerMinutes, timerState } from "../src/timer.mjs";

const at = (hm) => Date.parse(`2026-10-19T${hm}:00Z`);
const ev = (type, hm, id = "a") => ({ type, id, ts: `2026-10-19T${hm}:00Z` });

test("timer: pauses don't count, repeated pause/resume is ignored, a solve stops it", () => {
  const events = [ev("opened", "10:00"), ev("paused", "10:20"), ev("paused", "10:25"), ev("resumed", "11:00"), ev("resumed", "11:05"), ev("opened", "11:10")];
  assert.deepEqual(timerMinutes(events, "a", at("11:15")), { measured: 35, suggest: 35, pauses: 1, pausedMinutes: 40 });
  const t = timerState(events, "a", at("11:15"));
  assert.equal(t.state, "running");
  assert.equal(t.startedAt, at("10:00"));
  const paused = [...events, ev("paused", "11:30")];
  assert.equal(timerState(paused, "a", at("15:00")).state, "paused");
  assert.equal(timerMinutes(paused, "a", at("15:00")).measured, 50, "done while paused counts up to the pause");
  const solved = [...events, ev("solved", "11:20"), ev("paused", "11:30")];
  assert.equal(timerState(solved, "a", at("18:00")).state, "ended");
  assert.equal(timerMinutes(solved, "a", at("18:00")).measured, 40, "nothing after the solve");
});

test("timer: a long day with a pause stays under the cap; paused before any open starts paused", () => {
  const lunch = [ev("opened", "09:00"), ev("paused", "10:00"), ev("resumed", "15:00")];
  assert.deepEqual(timerMinutes(lunch, "a", at("16:00")), { measured: 120, suggest: 120, pauses: 1, pausedMinutes: 300 });
  const early = [ev("paused", "08:00"), ev("opened", "09:00"), ev("resumed", "09:00")];
  assert.deepEqual(timerMinutes(early, "a", at("09:30")), { measured: 30, suggest: 30, pauses: 0, pausedMinutes: 0 });
  assert.equal(timerState([ev("paused", "08:00")], "a", at("09:00")).activeMs, 0);
});

test("notes: done fills the empty fields only, and adds Result to older notes", () => {
  const values = noteValues({
    outcome: { kind: "solved", date: "2026-10-19", points: 85, review: false },
    minutes: 30, minutesSource: "timer", timer: { measured: 30, pauses: 1, pausedMinutes: 15 },
    pace: { expected: 27, pct: 11, band: "on pace" }, hintsUsed: [1], hintsTotal: 3, startedAt: null,
  });
  assert.deepEqual(values, {
    "Time spent": "30 min (timer; 1 pause, 15 min) · expected 27 (+11%), on pace",
    "Hints used": "1 of 3 (hint 1)",
    Result: "solved 2026-10-19 · +85 pts",
  });
  const fresh = fillNotes(notesTemplate("T"), values);
  assert.equal(fresh.text, "# Notes: T\n\n- Time spent: 30 min (timer; 1 pause, 15 min) · expected 27 (+11%), on pace\n- Hints used: 1 of 3 (hint 1)\n- Result: solved 2026-10-19 · +85 pts\n- What tripped me up:\n- What I'd do differently:\n");
  const old = "# Notes: T\n\n- Time spent: about an hour, honestly\n- Hints used:\n- What tripped me up: ownership\n- What I'd do differently:\n\n## Review (2026-10-19)\n\n- Result: not a field\n";
  const r = fillNotes(old, values);
  assert.deepEqual(r.filled, ["Hints used", "Result"]);
  assert.match(r.text, /- Time spent: about an hour, honestly\n- Hints used: 1 of 3 \(hint 1\)\n- Result: solved/);
  assert.match(r.text, /- What tripped me up: ownership\n/);
  assert.deepEqual(fillNotes(r.text, values).filled, [], "a second run changes nothing");
});

test("notes: give-ups, typed minutes and no time", () => {
  assert.deepEqual(noteValues({ outcome: { kind: "gaveup", date: "2026-10-19", review: true }, timer: { measured: 50 }, hintsUsed: [1, 2, 3], hintsTotal: 3 }), {
    "Time spent": "50 min on the timer before giving up", "Hints used": "3 of 3 (hints 1, 2, 3)", Result: "gave up 2026-10-19 · comes back as a review",
  });
  const typed = noteValues({ outcome: { kind: "solved", date: "2026-10-19", points: 100 }, minutes: 45, minutesSource: "typed", timer: { pauses: 2 } });
  assert.equal(typed["Time spent"], "45 min (typed)");
  assert.equal(typed["Hints used"], "0");
  assert.equal(noteValues({ outcome: { kind: "solved", date: "2026-10-19" }, minutes: null })["Time spent"], "not recorded");
  assert.equal(noteValues({ outcome: { kind: "solved", date: "2026-10-19", points: 100, accidental: [2], review: true } }).Result,
    "solved 2026-10-19 · +100 pts · item 2 caught only by accident · comes back as a review");
});

test("ginga pause / resume / timer / list end to end", () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-timer-")));
  try {
    const ws = join(tmp, "ws");
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ version: 2, rotation: ["c"] }));
    const ids = ["2026-10-18-c-old", "2026-10-19-c-new"];
    for (const id of ids) {
      const dir = join(ws, "challenges", id);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "challenge.json"), JSON.stringify({ id, title: id, lang: "c", level: 1, type: "implement", date: id.slice(0, 10) }));
    }
    writeFileSync(join(ws, "progress.jsonl"), ids.map((id) => JSON.stringify({ type: "generated", id, lang: "c", level: 1, title: id, source: "daily", date: id.slice(0, 10), ts: `${id.slice(0, 10)}T08:00:00Z` })).join("\n") + "\n");
    const run = (...a) => spawnSync(process.execPath, [join(import.meta.dirname, "..", "bin", "ginga.mjs"), ...a, "-w", ws],
      { encoding: "utf8", timeout: 20000, cwd: tmp, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });
    assert.match(run("timer").stdout, /^○ {2}not started .* · 2026-10-19-c-new 2026-10-19-c-new\n$/);
    assert.match(run("resume").stderr, /hasn't started/);
    assert.match(run("pause").stdout, /starts paused/);
    assert.match(run("pause").stdout, /Already paused/);
    assert.match(run("list").stdout, /open ⏸ +2026-10-19-c-new/);
    assert.match(run("resume").stdout, /Resumed "2026-10-19-c-new"/);
    assert.match(run("timer").stdout, /▶ {2}running · 0 min active/);
    assert.match(run("pause", "2026-10-18").stdout, /starts paused/, "an id picks another challenge");
    const types = readFileSync(join(ws, "progress.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((e) => e.type !== "generated").map((e) => `${e.type}:${e.id.slice(11)}`);
    assert.deepEqual(types, ["paused:c-new", "resumed:c-new", "paused:c-old"]);
    assert.equal(JSON.parse(run("list", "--json").stdout).find((c) => c.id === ids[0]).timer, "paused");
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("give-up reason: fills What tripped me up, and the topic's reviews aim at it", async () => {
  const { dueReview } = await import("../src/reviews.mjs");
  const v = noteValues({ outcome: { kind: "gaveup", date: "2026-10-20", review: true }, reason: "bit tricks without a loop" });
  assert.equal(v["What tripped me up"], "bit tricks without a loop");
  assert.equal(fillNotes("- What tripped me up: mine\n", v).text, "- What tripped me up: mine\n", "never overwritten");
  const day = (d) => `2026-10-${String(d).padStart(2, "0")}`;
  const g = (id, d, extra = {}) => ({ type: "generated", id, lang: "c", level: 1, title: id, date: day(d), ts: `${day(d)}T08:00:00Z`, ...extra });
  const quit = (id, d, reason) => ({ type: "gaveup", id, lang: "c", level: 1, date: day(d), ts: `${day(d)}T20:00:00Z`, ...(reason ? { reason } : {}) });
  const events = [g("x", 1), quit("x", 1, "pointer math"), g("r1", 4, { reviewOf: "x" }), quit("r1", 4, "off by one at the end"), g("y", 1), quit("y", 1)];
  assert.deepEqual(dueReview(events, [3, 7, 21], day(9)).stuckOn, ["pointer math", "off by one at the end"]);
  assert.equal(dueReview(events.slice(4), [3, 7, 21], day(9)).stuckOn, undefined, "no reason, no field");
});
