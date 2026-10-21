import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { stillNeeded } from "../src/cli.mjs";
import { table } from "../src/view.mjs";
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

test("ginga list: creation order, and where each challenge came from", () => {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-list-")));
  try {
    const ws = join(tmp, "ws");
    writeFileSync(join(mkdirP(ws), "gingaloop.json"), JSON.stringify({ version: 2, rotation: ["c"] }));
    const ch = [
      ["2026-10-08-c-rotate", "Rotate in place", "daily", null],
      ["2026-10-08-c-manual", "Manual one", "manual", null],
      ["2026-10-11-c-chunks", "Reverse in chunks", "daily", "2026-10-08-c-rotate"],
      ["2026-10-15-c-zeros", "Move zeros", "daily", "2026-10-11-c-chunks"],
      ["2026-10-15-a-first-alphabetically", "Created last", "daily", null],
    ];
    const events = [];
    for (const [id, title, source, reviewOf] of ch) {
      const dir = mkdirP(join(ws, "challenges", id));
      writeFileSync(join(dir, "challenge.json"), JSON.stringify({ id, title, lang: "c", level: 1, type: "implement", date: id.slice(0, 10) }));
      events.push(JSON.stringify({ type: "generated", id, lang: "c", level: 1, title, source, date: id.slice(0, 10), ...(reviewOf ? { reviewOf } : {}) }));
    }
    writeFileSync(join(ws, "progress.jsonl"), events.join("\n") + "\n");
    const run = (...a) => spawnSync(process.execPath, [join(import.meta.dirname, "..", "bin", "ginga.mjs"), "list", "-w", ws, ...a],
      { encoding: "utf8", timeout: 20000, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });
    const r = run();
    assert.equal(r.status, 0, r.stderr);
    const lines = r.stdout.trimEnd().split("\n");
    assert.match(lines[0], /^Created +Language +Lvl +Type +From +Status +Id$/);
    assert.deepEqual(lines.slice(2, 2 + ch.length).map((l) => l.split(/\s+/).at(-1)), ch.map((c) => c[0]), "creation order, not alphabetical");
    assert.equal(lines.at(-1), "5 challenges · 5 open · 🔁 review of that topic", "a summary under the table");
    assert.match(lines[2], / daily /);
    assert.match(lines[3], / manual /);
    assert.match(lines[4], /🔁 Rotate in place/);
    assert.match(lines[5], /🔁 Rotate in place/, "a review of a review names the original topic");
    const json = JSON.parse(run("--json").stdout);
    assert.deepEqual(json.map((j) => [j.source, j.reviewOf]).slice(2, 4), [["daily", "2026-10-08-c-rotate"], ["daily", "2026-10-11-c-chunks"]]);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

function mkdirP(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}
