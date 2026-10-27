// `ginga commit` / `ginga push` / `ginga sync` for the workspace repo. The commit message is built
// from the facts in progress.jsonl and the changed files: deterministic, no Claude involved.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { END, START } from "./dashboard.mjs";
import { levelState, pointsFor } from "./levels.mjs";
import { eventDate } from "./progress.mjs";
import { UserError } from "./workspace.mjs";

/**
 * Run git in the workspace. `unattended` (the scheduled daily) never waits for a person: no
 * password prompts, ssh in batch mode, and a time limit, so a GPG or ssh prompt nobody answers
 * fails the step instead of hanging the job.
 */
export function git(ws, args, { inherit = false, unattended = false } = {}) {
  const env = unattended
    ? { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: `${process.env.GIT_SSH_COMMAND || "ssh"} -o BatchMode=yes` }
    : process.env;
  const r = spawnSync("git", args, {
    cwd: ws, env, encoding: "utf8", stdio: inherit && !unattended ? "inherit" : "pipe",
    ...(unattended ? { timeout: UNATTENDED_TIMEOUT_MS } : {}),
  });
  if (r.error?.code === "ETIMEDOUT") throw new UserError(`git ${args[0]} took over ${UNATTENDED_TIMEOUT_MS / 1000} s with nobody to answer a prompt (GPG passphrase? ssh key?).`);
  if (r.error) throw new UserError(`Cannot run git (${r.error.code ?? r.error.message}). Is it installed?`);
  return r;
}

const UNATTENDED_TIMEOUT_MS = 90_000;

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
  const counts = { solve: 0, new: 0, giveup: 0, discard: 0, learn: 0 };
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
    } else if (e.type === "discarded") {
      counts.discard++;
      lines.push(`- discard(${e.lang}): ${title(e.id)}${e.reason ? ` · ${e.reason}` : ""}`);
    } else if (e.type === "learned") {
      counts.learn++;
      const parts = [e.lessons && plural(e.lessons, "lesson"), e.improvements && plural(e.improvements, "tool idea")].filter(Boolean);
      lines.push(`- learn(${e.lang}): ${title(e.id)}${parts.length ? ` · ${parts.join(", ")}` : ""}`);
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
  if (counts.learn) DERIVED.add("LESSONS.md").add("IMPROVEMENTS.md"); // implied by the learn lines
  for (const f of files) {
    const m = /^challenges\/([^/]+)\/NOTES\.md$/.exec(f);
    if (m) notes.add(m[1]);
    else if (!DERIVED.has(f) && !f.startsWith("challenges/")) other.push(f);
  }
  const touchedByEvents = new Set(newEvents.map((e) => e.id));
  // `done` / `giveup` fill NOTES.md themselves: alongside that solve or give-up it isn't news.
  const finished = new Set(newEvents.filter((e) => e.type === "solved" || e.type === "gaveup").map((e) => e.id));
  for (const id of notes) {
    if (finished.has(id)) continue;
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
    counts.discard && `discard ${counts.discard}`,
    counts.learn && `learn ${counts.learn}`,
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

const hasUpstream = (ws) => git(ws, ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]).status === 0;

const lastLines = (r) => `${r.stderr ?? ""}${r.stdout ?? ""}`.trim().split("\n").slice(-3).join(" / ");

/** `git push`, setting the upstream on the first push. */
export function pushWorkspace(ws, { unattended = false } = {}) {
  ensureRepo(ws);
  let r;
  if (hasUpstream(ws)) {
    r = git(ws, ["push", "-q"], { inherit: true, unattended });
  } else {
    if (!git(ws, ["remote"]).stdout.split("\n").includes("origin")) {
      throw new UserError("The workspace repo has no `origin` remote. Add one: git remote add origin <url>");
    }
    r = git(ws, ["push", "-q", "-u", "origin", "HEAD"], { inherit: true, unattended });
  }
  if (r.status !== 0) throw new UserError(`git push failed${unattended ? `: ${lastLines(r)}` : " (see above)"}.`);
}

/**
 * Lines for .gitattributes so two machines' work merges by itself: append-only files keep both
 * sides' lines. (The dashboard and INDEX.md are regenerated instead; see pullWorkspace.)
 */
export const SYNC_ATTRIBUTES = ["/progress.jsonl merge=union", "/LESSONS.md merge=union", "/IMPROVEMENTS.md merge=union"];

/**
 * Add the missing SYNC_ATTRIBUTES lines to .gitattributes (committed, for every clone) and to
 * .git/info/attributes: a rebase reads the attributes of the tree it rebases onto, and the other
 * machine's tree may come from an older gingaloop that didn't write them.
 */
export function ensureSyncAttributes(ws) {
  const local = resolve(ws, git(ws, ["rev-parse", "--git-path", "info/attributes"]).stdout.trim());
  for (const path of [join(ws, ".gitattributes"), local]) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    const have = new Set(current.split(/\r?\n/).map((l) => l.trim()));
    const missing = SYNC_ATTRIBUTES.filter((l) => !have.has(l));
    if (!missing.length) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, current + (current && !current.endsWith("\n") ? "\n" : "") + missing.join("\n") + "\n");
  }
}

/** README.md without the generated dashboard: the part a person writes. */
const ownText = (readme) => {
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  return s !== -1 && e > s ? readme.slice(0, s) + readme.slice(e + END.length) : readme;
};

/**
 * A rebase conflict ginga can settle: INDEX.md, or README.md when only its dashboard differs.
 * Both are rebuilt from progress.jsonl after the pull, so either side will do.
 */
function regenerable(ws, file) {
  if (file === "INDEX.md") return true;
  if (file !== "README.md") return false;
  const side = (n) => git(ws, ["show", `:${n}:README.md`]);
  const [a, b] = [side(2), side(3)];
  return a.status === 0 && b.status === 0 && ownText(a.stdout) === ownText(b.stdout);
}

const rebasing = (ws) => existsSync(resolve(ws, git(ws, ["rev-parse", "--git-path", "rebase-merge"]).stdout.trim()));

/** The rebase stopped on a commit with nothing left once its view conflicts were settled. */
const stoppedOnEmptyCommit = (ws) => rebasing(ws) && git(ws, ["diff", "--cached", "--quiet"]).status === 0;

/**
 * `git pull --rebase` with the work committed first (the caller's job). Conflicts in the generated
 * views are settled (the caller rebuilds them); any other conflict aborts the rebase, leaving the
 * repo as it was, and throws.
 * @returns {boolean} whether anything came in
 */
export function pullWorkspace(ws, { unattended = false } = {}) {
  ensureRepo(ws);
  if (!hasUpstream(ws)) throw new UserError("The workspace has no upstream branch yet: run `ginga push` once first.");
  const before = git(ws, ["rev-parse", "HEAD"]).stdout.trim();
  const fetch = git(ws, ["fetch", "-q"], { unattended });
  if (fetch.status !== 0) throw new UserError(`git fetch failed: ${lastLines(fetch)}`);
  let r = git(ws, ["rebase", "-q", "@{u}"], { unattended });
  for (let guard = 0; r.status !== 0 && guard < 100; guard++) {
    const conflicts = git(ws, ["diff", "--name-only", "--diff-filter=U"]).stdout.split("\n").filter(Boolean);
    if (!conflicts.length && stoppedOnEmptyCommit(ws)) {
      r = git(ws, ["rebase", "--skip"], { unattended }); // a commit that only touched the views
      continue;
    }
    const blocking = conflicts.filter((f) => !regenerable(ws, f));
    if (!conflicts.length || blocking.length) {
      git(ws, ["rebase", "--abort"]);
      throw new UserError(
        blocking.length
          ? `Both machines changed ${blocking.join(", ")}: nothing was merged. Settle it by hand with \`git pull --rebase\` in ${ws}.`
          : `git rebase failed: ${lastLines(r)}`,
      );
    }
    for (const f of conflicts) git(ws, ["checkout", "--ours", "--", f]);
    git(ws, ["add", "--", ...conflicts]);
    r = git(ws, ["-c", "core.editor=true", "rebase", "--continue"], { unattended });
  }
  return git(ws, ["rev-parse", "HEAD"]).stdout.trim() !== before;
}
