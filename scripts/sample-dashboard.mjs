// Builds a sample workspace with ~10 weeks of made-up practice and prints its dashboard Markdown.
// Used to render docs/dashboard-preview.png. Usage: node scripts/sample-dashboard.mjs <empty-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderDashboard } from "../src/dashboard.mjs";
import { levelState } from "../src/levels.mjs";
import { DEFAULT_CONFIG } from "../src/workspace.mjs";

const ws = process.argv[2];
if (!ws) throw new Error("usage: node scripts/sample-dashboard.mjs <empty-dir>");
const TODAY = "2026-12-11";
const config = structuredClone({ ...DEFAULT_CONFIG, rotation: ["typescript", "python", "c", "cpp"] });

const titles = {
  typescript: ["Typed event emitter", "Exhaustive state machine", "Deep readonly config", "Branded user ids", "Result type helpers", "Retry with backoff", "Typed query builder", "Discriminated API responses", "Generic LRU cache", "Path param parser"],
  python: ["Run-length encoding", "Top k words", "Page ranges", "Sliding window max", "Interval merge", "Context-managed timer", "Lazy CSV reader", "Ring buffer", "Bracket matcher"],
  c: ["Count words", "Remove value in place", "Safe string copy", "Bit set", "Growable array", "Parse integers with errno"],
  cpp: ["Reverse words", "Word histogram", "RAII file handle", "Small vector"],
};
const areas = {
  typescript: ["unions-narrowing", "generics", "readonly", "type-guards", "strings", "hashing", "branded-types", "arrays"],
  python: ["strings", "hashing", "parsing", "windows-pointers", "intervals", "context-managers", "iterators-generators", "arrays"],
  c: ["c-strings", "pointers-arrays", "strings", "bit-manipulation", "dynamic-memory", "math-bits"],
  cpp: ["stl-containers", "strings", "string-view", "raii"],
};
// Deterministic pseudo-random so the image is reproducible.
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const events = [];
const day = (n) => new Date(Date.parse(TODAY + "T12:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);
const used = { typescript: 0, python: 0, c: 0, cpp: 0 };
// TypeScript is the favorite; C++ just started.
const weighted = ["typescript", "typescript", "typescript", "typescript", "python", "python", "python", "c", "c", "cpp"];
mkdirSync(join(ws, "challenges"), { recursive: true });

for (let n = 72; n >= 0; n--) {
  const date = day(n);
  if (rnd() < 0.18 && n > 2) continue; // some days off
  const lang = n < 6 ? ["cpp", "c", "typescript", "python", "typescript", "cpp"][n] : weighted[Math.floor(rnd() * weighted.length)];
  const i = used[lang]++ % titles[lang].length;
  const title = titles[lang][i];
  const id = `${date}-${lang}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const lvl = levelState(events, lang, config.leveling).level;
  const ts = `${date}T08:00:00Z`;
  events.push({ ts, date, type: "generated", id, lang, level: lvl, title, topics: [], source: "daily", area: areas[lang][i % areas[lang].length] });
  mkdirSync(join(ws, "challenges", id), { recursive: true });
  writeFileSync(join(ws, "challenges", id, "challenge.json"), JSON.stringify({ id, date, lang, level: lvl, title, type: "implement" }));
  if (n === 0) continue; // today's challenge still open
  const r = rnd();
  const hints = r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
  if (r > 0.94) events.push({ ts: `${date}T21:00:00Z`, date, type: "gaveup", id, lang, level: lvl, topics: [] });
  else {
    for (let h = 1; h <= hints; h++) events.push({ ts: `${date}T19:0${h}:00Z`, date, type: "hint", id, lang, level: lvl, hint: h });
    events.push({ ts: `${date}T20:00:00Z`, date, type: "solved", id, lang, level: lvl, topics: [], hints, minutes: 12 + Math.round(rnd() * 35) });
  }
}
writeFileSync(join(ws, "progress.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + "\n");
process.stdout.write(renderDashboard(ws, config, TODAY));
