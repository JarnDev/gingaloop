// Workspace views: README.md dashboard (between markers) and INDEX.md (full list).
// Both are derived from progress.jsonl + challenges/, and rewritten after every change.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listChallenges, writeIndex } from "./challenges.mjs";
import { coverageCounts, unlockedAreas } from "./coverage.mjs";
import { levelState, streakState } from "./levels.mjs";
import { findProfile } from "./profiles.mjs";
import { challengeStatus, eventDate, readEvents } from "./progress.mjs";
import { loadConfig, today } from "./workspace.mjs";

export const START = "<!-- gingaloop:start -->";
export const END = "<!-- gingaloop:end -->";
const WEEKS = 12;

const fmt = (n) => n.toLocaleString("en-US");

function bar(done, total, width = 12) {
  const filled = total <= 0 ? width : Math.max(0, Math.min(width, Math.round((done / total) * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * 7 rows (Mon..Sun) × WEEKS columns, best outcome of the day wins:
 * 🟩 solved without hints · 🟨 solved with hints · 🟥 gave up · 🧊 freeze · ⬜ nothing
 */
export function activityGrid(events, date, frozeOn = []) {
  const clean = new Set();
  const hinted = new Set();
  const gaveUp = new Set();
  for (const e of events) {
    if (e.type === "solved" && !e.afterGiveup && !e.hints) clean.add(eventDate(e));
    else if (e.type === "solved") hinted.add(eventDate(e));
    else if (e.type === "gaveup") gaveUp.add(eventDate(e));
  }
  const frozen = new Set(frozeOn);
  const dow = (new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(date, -dow - 7 * (WEEKS - 1));
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names.map((name, row) => {
    let line = `${name} `;
    for (let w = 0; w < WEEKS; w++) {
      const day = addDays(start, w * 7 + row);
      if (day > date) line += "  ";
      else if (clean.has(day)) line += "🟩";
      else if (hinted.has(day)) line += "🟨";
      else if (gaveUp.has(day)) line += "🟥";
      else if (frozen.has(day)) line += "🧊";
      else line += "⬜";
    }
    return line.trimEnd();
  });
}

export function renderDashboard(ws, config, date = today()) {
  const events = readEvents(ws);
  const challenges = listChallenges(ws);
  const solvedEvents = [...new Map(events.filter((e) => e.type === "solved").map((e) => [e.id, e])).values()];
  const gaveUp = new Set(events.filter((e) => e.type === "gaveup").map((e) => e.id));
  const mins = solvedEvents.map((e) => e.minutes).filter(Number.isFinite);
  const st = streakState(solvedEvents.map(eventDate), date);

  const head = [
    `🔥 **${st.days}-day streak**`,
    st.freezes ? `❄️ ${st.freezes} freeze${st.freezes === 1 ? "" : "s"}` : null,
    `✅ ${solvedEvents.length} solved`,
    `🟥 ${gaveUp.size} gave up`,
    mins.length ? `⏱️ ${Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)} min avg` : null,
  ].filter(Boolean).join(" · ");

  const langs = [...new Set([
    ...config.rotation.map((l) => findProfile(ws, l)?.id ?? l),
    ...events.map((e) => e.lang).filter(Boolean),
  ])];

  const levelRows = langs.map((lang) => {
    const p = findProfile(ws, lang);
    const s = levelState(events, lang, config.leveling);
    const floor = s.level === 1 ? 0 : config.leveling.thresholds[s.level - 2];
    const progress = s.nextAt == null
      ? "max level"
      : `\`${bar(s.points - floor, s.nextAt - floor)}\` ${fmt(s.points)} / ${fmt(s.nextAt)} pts`;
    const solved = solvedEvents.filter((e) => e.lang === lang);
    const m = solved.map((e) => e.minutes).filter(Number.isFinite);
    const avg = m.length ? `${Math.round(m.reduce((a, b) => a + b, 0) / m.length)} min` : "–";
    return `| ${p?.name ?? lang} | L${s.level} | ${progress} | ${solved.length} | ${avg} |`;
  });

  const coverageRows = langs.flatMap((lang) => {
    const p = findProfile(ws, lang);
    if (!p) return [];
    const { level } = levelState(events, lang, config.leveling);
    const counts = coverageCounts(events, lang);
    const open = unlockedAreas(p, level);
    const covered = open.filter((a) => counts.get(a.id)).length;
    const min = Math.min(...open.map((a) => counts.get(a.id) ?? 0));
    const next = open.filter((a) => (counts.get(a.id) ?? 0) === min).slice(0, 3).map((a) => `\`${a.id}\``);
    return [`| ${p.name} | ${covered} / ${open.length} at L${level} | ${next.join(", ")} |`];
  });

  const statusIcon = { open: "⬜ open", solved: "✅ solved", gaveup: "🟥 gave up" };
  const recent = challenges.slice(-10).reverse().map(({ manifest: m }) => {
    const s = challengeStatus(events, m.id);
    const solve = solvedEvents.find((e) => e.id === m.id);
    const time = Number.isFinite(solve?.minutes) ? `${solve.minutes} min` : "";
    const hints = s.hints ? String(s.hints) : "";
    return `| ${m.date} | ${m.lang} | L${m.level} | [${m.title}](challenges/${m.id}/README.md) | ${statusIcon[s.status]} | ${time} | ${hints} |`;
  });

  return [
    START,
    "# 🥋 gingaloop",
    "",
    head,
    "",
    `_Updated ${date} by [gingaloop](https://github.com/JarnDev/gingaloop). Do not edit between the markers._`,
    "",
    "## Levels",
    "",
    "| Language | Level | Progress to next | Solved | Avg time |",
    "|---|---|---|---|---|",
    ...levelRows,
    "",
    `## Activity (last ${WEEKS} weeks)`,
    "",
    "```",
    ...activityGrid(events, date, st.frozeOn),
    "```",
    "🟩 solved without hints · 🟨 solved with hints · 🟥 gave up · 🧊 streak freeze · ⬜ nothing",
    "",
    "## Coverage",
    "",
    "| Language | Areas covered | Next up |",
    "|---|---|---|",
    ...coverageRows,
    "",
    "## Recent challenges",
    "",
    ...(recent.length
      ? ["| Date | Lang | Lvl | Challenge | Status | Time | Hints |", "|---|---|---|---|---|---|---|", ...recent]
      : ["No challenges yet: run `ginga new <lang>`."]),
    "",
    `Full list: [INDEX.md](INDEX.md)`,
    END,
  ].join("\n");
}

/** Replace the marked block in README.md; add it on top if there are no markers yet. */
export function writeDashboard(ws, config = loadConfig(ws)) {
  const path = join(ws, "README.md");
  const block = renderDashboard(ws, config);
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const s = current.indexOf(START);
  const e = current.indexOf(END);
  let next;
  if (s !== -1 && e > s) next = current.slice(0, s) + block + current.slice(e + END.length);
  else next = block + "\n" + (current.trim() ? `\n${current.trimStart()}` : "");
  if (!next.endsWith("\n")) next += "\n";
  if (next !== current) writeFileSync(path, next);
}

/** Rewrite every derived view of the workspace. */
export function refreshViews(ws) {
  writeIndex(ws);
  writeDashboard(ws);
}
