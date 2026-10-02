import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { END, START, activityGrid, writeDashboard } from "../src/dashboard.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const tmp = mkdtempSync(join(tmpdir(), "gingaloop-dash-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

test("activity grid: 7 rows Mon..Sun, colored by kind of day, nothing after today", () => {
  const events = [
    { type: "solved", date: "2026-10-01", hints: 0 }, // Thu: clean
    { type: "solved", date: "2026-09-30", hints: 2 }, // Wed: hints
    { type: "gaveup", date: "2026-09-29" }, // Tue: gave up
    { type: "gaveup", date: "2026-10-01" }, // Thu also had a give-up, but a clean solve wins
  ];
  const rows = activityGrid(events, "2026-10-02", ["2026-09-28"]); // Fri; Mon frozen
  assert.equal(rows.length, 7);
  assert.ok(rows[0].startsWith("Mon ") && rows[0].endsWith("🧊"));
  assert.ok(rows[1].endsWith("🟥"), "gave up is red");
  assert.ok(rows[2].endsWith("🟨"));
  assert.ok(rows[3].endsWith("🟩"));
  assert.ok(rows[4].endsWith("⬜"), "today (Fri) has nothing yet");
  assert.equal([...rows[5].slice(4)].length, 11, "Saturday of this week is in the future, so one cell shorter");
});

test("dashboard replaces only the marked block and keeps the user's text", () => {
  const ws = join(tmp, "ws");
  mkdirSync(join(ws, "challenges"), { recursive: true });
  const config = structuredClone({ ...DEFAULT_CONFIG, rotation: ["python"] });
  writeFileSync(join(ws, "README.md"), "# My notes\n\nKeep me.\n");
  writeDashboard(ws, config);
  let text = readFileSync(join(ws, "README.md"), "utf8");
  assert.ok(text.startsWith(START), "added on top when there are no markers");
  assert.ok(text.includes("# My notes\n\nKeep me."));
  const edited = text.replace("Keep me.", "Keep me, edited.") + "\nFooter.\n";
  writeFileSync(join(ws, "README.md"), edited);
  writeDashboard(ws, config);
  text = readFileSync(join(ws, "README.md"), "utf8");
  assert.equal(text.split(START).length, 2, "exactly one dashboard block");
  assert.ok(text.includes("Keep me, edited.") && text.includes("Footer."));
  assert.ok(text.indexOf(END) < text.indexOf("# My notes"));
  assert.ok(text.includes("| Python | L1 |"));
});
