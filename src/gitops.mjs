// `ginga commit` / `ginga push` for the workspace repo. The commit message is built from the
// facts in progress.jsonl and the changed files: deterministic, no Claude involved.
import { spawnSync } from "node:child_process";
import { levelState, pointsFor } from "./levels.mjs";
import { eventDate } from "./progress.mjs";
import { UserError } from "./workspace.mjs";

export function git(ws, args, { inherit = false } = {}) {
  const r = spawnSync("git", args, { cwd: ws, encoding: "utf8", stdio: inherit ? "inherit" : "pipe" });
  if (r.error) throw new UserError(`Cannot run git (${r.error.code ?? r.error.message}). Is it installed?`);
  return r;
}

export function ensureRepo(ws) {
  const r = git(ws, ["rev-parse", "--show-toplevel"]);
  if (r.status !== 0) {
    throw new UserError(`${ws} is not a git repository. Start one with: cd ${ws} && git init`);
  }
}

/** Events added to progress.jsonl in the staged changes (lines added by the diff). */
export function stagedNewEvents(ws) {
  const diff = git(ws, ["diff", "--cached", "-U0", "--no-color", "--", "progress.jsonl"]).stdout;
  const out = [];
  for (const line of diff.split("\n")) {
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    try {
      out.push(JSON.parse(line.slice(1)));
    } catch {}
  }
  return out;
}

export function stagedFiles(ws) {
  return git(ws, ["diff", "--cached", "--name-only", "-z"]).stdout.split("\0").filter(Boolean);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function dateLabel(dates) {
  const sorted = [...new Set(dates)].sort();
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const [a, b] = [sorted[0], sorted.at(-1)];
  return a.slice(0, 4) === b.slice(0, 4) ? `${a}..${b.slice(5)}` : `${a}..${b}`;
}

/**
 * Build the commit message.
 * @param {object[]} allEvents  every event, after the staged changes (chronological)
 * @param {object[]} newEvents  the events this commit adds
 * @param {string[]} files      staged file paths
 */
export function buildCommitMessage({ allEvents, newEvents, files, leveling, today, levelOf = (history, lang) => levelState(history, lang, leveling).level }) {
  const isNew = new Set(newEvents.map((e) => JSON.stringify(e)));
  const titles = new Map(allEvents.filter((e) => e.type === "generated").map((e) => [e.id, e]));
  const title = (id) => titles.get(id)?.title ?? id;
  const lines = [];
  const counts = { solve: 0, new: 0, giveup: 0 };
  const before = new Map(); // lang -> level before this commit's events

  allEvents.forEach((e, i) => {
    if (!isNew.has(JSON.stringify(e))) return;
    const history = allEvents.slice(0, i);
    if (e.lang && !before.has(e.lang)) before.set(e.lang, levelOf(history, e.lang));
    if (e.type === "solved") {
      counts.solve++;
      const level = levelOf(history, e.lang);
      const pts = pointsFor(e, level, leveling);
      const parts = [title(e.id), `L${e.level}`];
      if (Number.isFinite(e.minutes)) parts.push(`${e.minutes} min`);
      parts.push(plural(e.hints ?? 0, "hint"), `+${pts} pts`);
      if (e.afterGiveup) parts.push("after giving up");
      lines.push(`- solve(${e.lang}): ${parts.join(" · ")}`);
    } else if (e.type === "generated") {
      counts.new++;
      const parts = [e.title ?? e.id, `L${e.level}`];
      if (e.area) parts.push(e.area);
      if (e.reviewOf) parts.push(`review of ${title(e.reviewOf)}`);
      lines.push(`- new(${e.lang}): ${parts.join(" · ")}`);
    } else if (e.type === "gaveup") {
      counts.giveup++;
      lines.push(`- giveup(${e.lang}): ${title(e.id)} · L${e.level}`);
    } else if (e.type === "hint") {
      lines.push(`- hint(${e.lang}): ${title(e.id)} · hint ${e.hint}`);
    }
  });

  const levelUps = [];
  for (const [lang, from] of before) {
    const to = levelOf(allEvents, lang);
    if (to > from) {
      levelUps.push(`${lang} L${to}`);
      lines.push(`- level-up(${lang}): L${from} → L${to}`);
    }
  }

  // Notes and other hand-edited files. Derived files (dashboard, index, log) are implied.
  const notes = new Set();
  const other = [];
  const DERIVED = new Set(["README.md", "INDEX.md", "progress.jsonl"]);
  for (const f of files) {
    const m = /^challenges\/([^/]+)\/NOTES\.md$/.exec(f);
    if (m) notes.add(m[1]);
    else if (!DERIVED.has(f) && !f.startsWith("challenges/")) other.push(f);
  }
  const touchedByEvents = new Set(newEvents.map((e) => e.id));
  for (const id of notes) {
    const g = titles.get(id);
    lines.push(`- notes(${g?.lang ?? "?"}): ${title(id)}`);
  }
  // Starter edits without a solve yet: work in progress.
  const wip = new Set();
  for (const f of files) {
    const m = /^challenges\/([^/]+)\/starter\//.exec(f);
    if (m && !touchedByEvents.has(m[1])) wip.add(m[1]);
  }
  for (const id of wip) lines.push(`- wip(${titles.get(id)?.lang ?? "?"}): ${title(id)}`);
  if (other.length) lines.push(`- files: ${other.join(", ")}`);

  const summary = [
    counts.solve && `solve ${counts.solve}`,
    counts.new && `new ${counts.new}`,
    counts.giveup && `give up ${counts.giveup}`,
  ].filter(Boolean);
  let subject;
  if (summary.length) {
    const when = dateLabel(newEvents.map(eventDate)) ?? today;
    subject = `practice(${when}): ${summary.join(", ")}${levelUps.length ? ` · ${levelUps.join(", ")}` : ""}`;
  } else if (notes.size || wip.size) {
    subject = `practice(${today}): ${[notes.size && plural(notes.size, "note"), wip.size && `${wip.size} in progress`].filter(Boolean).join(", ")}`;
  } else if (newEvents.some((e) => e.type === "hint")) {
    subject = `practice(${today}): hints`;
  } else {
    subject = `chore(workspace): update ${other.length ? other.join(", ") : "files"}`;
  }
  if (subject.length > 72) subject = subject.slice(0, 71) + "…";
  return lines.length ? `${subject}\n\n${lines.join("\n")}\n` : `${subject}\n`;
}

/** `git push`, setting the upstream on the first push. */
export function pushWorkspace(ws) {
  ensureRepo(ws);
  const upstream = git(ws, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  let r;
  if (upstream.status === 0) {
    r = git(ws, ["push"], { inherit: true });
  } else {
    if (!git(ws, ["remote"]).stdout.split("\n").includes("origin")) {
      throw new UserError("The workspace repo has no `origin` remote. Add one: git remote add origin <url>");
    }
    r = git(ws, ["push", "-u", "origin", "HEAD"], { inherit: true });
  }
  if (r.status !== 0) throw new UserError("git push failed (see above).");
}
