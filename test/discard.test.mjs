import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { coverageCounts } from "../src/coverage.mjs";
import { buildCommitMessage } from "../src/gitops.mjs";
import { challengeStatus, readEvents, withoutDiscarded } from "../src/progress.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const tmp = realpathSync(mkdtempSync(join(tmpdir(), "gingaloop-discard-")));
after(() => rmSync(tmp, { recursive: true, force: true }));
const BIN = join(import.meta.dirname, "..", "bin", "ginga.mjs");
const ginga = (args) =>
  spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", timeout: 20000, env: { ...process.env, XDG_CONFIG_HOME: join(tmp, "xdg") } });

const gen = { type: "generated", id: "2026-10-12-python-pairs", lang: "python", level: 1, title: "Pairs", area: "arrays", source: "daily", ts: "2026-10-12T10:00:00.000Z", date: "2026-10-12" };

function workspace() {
  const ws = join(tmp, "ws");
  const dir = join(ws, "challenges", gen.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(ws, "gingaloop.json"), JSON.stringify({ rotation: ["python"] }));
  writeFileSync(join(dir, "challenge.json"), JSON.stringify({ id: gen.id, title: gen.title, lang: "python", level: 1, date: gen.date, type: "implement", source: "daily" }));
  writeFileSync(join(ws, "progress.jsonl"), JSON.stringify(gen) + "\n");
  return ws;
}

test("discard: no penalty, hidden from generation, refused once closed", () => {
  const ws = workspace();
  const r = ginga(["discard", "--yes", "--reason", "tests contradict README", "-w", ws]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ginga daily/);
  const events = readEvents(ws);
  assert.equal(events.at(-1).type, "discarded");
  assert.equal(events.at(-1).reason, "tests contradict README");
  assert.equal(challengeStatus(events, gen.id).status, "discarded");
  assert.deepEqual(withoutDiscarded(events), [], "generation forgets it entirely");
  assert.equal(coverageCounts(withoutDiscarded(events), "python").get("arrays"), undefined, "its area comes back");
  assert.match(readFileSync(join(ws, "INDEX.md"), "utf8"), /⬛ discarded/);
  const again = ginga(["discard", "--yes", "-w", ws]);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /only open challenges/);
});

test("a solve wins over a later discard event; commit message lists discards", () => {
  const solved = { type: "solved", id: gen.id, lang: "python", level: 1, hints: 0 };
  assert.equal(challengeStatus([gen, solved, { type: "discarded", id: gen.id }], gen.id).status, "solved");
  const discarded = { type: "discarded", id: gen.id, lang: "python", level: 1, reason: "duplicate", ts: "2026-10-12T11:00:00.000Z", date: "2026-10-12" };
  const msg = buildCommitMessage({ allEvents: [gen, discarded], newEvents: [discarded], files: ["progress.jsonl"], leveling: DEFAULT_CONFIG.leveling, today: "2026-10-12" });
  assert.match(msg, /^practice\(2026-10-12\): discard 1\n/);
  assert.match(msg, /- discard\(python\): Pairs · duplicate/);
});
