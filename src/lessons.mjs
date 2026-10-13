// Lessons: what reviews found wrong with generated challenges, fed back into the next generations.
// LESSONS.md (rules for the generator prompt) and IMPROVEMENTS.md (ideas for gingaloop itself) live
// in the workspace; promoting a lesson into the tool for every user goes through an issue (--report).
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const LESSONS_FILE = "LESSONS.md";
export const IMPROVEMENTS_FILE = "IMPROVEMENTS.md";
export const ISSUES_URL = "https://github.com/JarnDev/gingaloop/issues/new";
const ALL = "All languages";
/** Lessons per scope that go into a generation prompt (newest kept). */
export const LESSONS_CAP = 30;

const LESSONS_HEADER = `# Lessons for the challenge generator

Rules learned from reviews of past challenges (\`ginga learn\`). Every generation in a language
follows the "${ALL}" rules plus that language's own, newest ${LESSONS_CAP} of each. Edit or delete
freely: \`ginga learn\` only adds bullets under these headings.
`;

const IMPROVEMENTS_HEADER = `# Ideas for gingaloop itself

Problems a review traced to the tool (validator, runner, prompts), not to one challenge.
\`ginga learn --report\` opens a pre-filled issue for them on ${ISSUES_URL.replace(/\/issues\/new$/, "")}.
`;

/** The last `## Review (date)` section of a NOTES.md, or null. */
export function latestReview(notes) {
  const starts = [...notes.matchAll(/^## Review \((\d{4}-\d{2}-\d{2})\)[ \t]*$/gm)];
  if (!starts.length) return null;
  const last = starts.at(-1);
  return { date: last[1], text: notes.slice(last.index + last[0].length).trim() };
}

/** Bullets of LESSONS.md by scope: "all" or a language id. */
export function readLessons(ws) {
  const path = join(ws, LESSONS_FILE);
  const out = {};
  if (!existsSync(path)) return out;
  let scope = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const h = /^## (.+?)\s*$/.exec(line);
    if (h) scope = h[1] === ALL ? "all" : h[1].toLowerCase();
    else if (scope && /^- \S/.test(line)) (out[scope] ??= []).push(line.slice(2).trim());
    else if (scope && /^\s+\S/.test(line) && out[scope]?.length) out[scope][out[scope].length - 1] += ` ${line.trim()}`;
  }
  return out;
}

/** The lessons block for a generation prompt in `lang`. */
export function lessonsFor(ws, lang, cap = LESSONS_CAP) {
  const all = readLessons(ws);
  const parts = [];
  if (all.all?.length) parts.push(`For every language:\n${all.all.slice(-cap).map((l) => `- ${l}`).join("\n")}`);
  if (all[lang]?.length) parts.push(`For this language:\n${all[lang].slice(-cap).map((l) => `- ${l}`).join("\n")}`);
  return parts.join("\n\n") || "(none yet)";
}

/**
 * Add lessons under their scope's heading (created at the end when missing), keeping the rest of
 * the file as the user left it.
 * @param {{rule:string, scope:string}[]} lessons  scope "all" or a language id
 */
export function addLessons(ws, lessons, source) {
  const path = join(ws, LESSONS_FILE);
  let lines = (existsSync(path) ? readFileSync(path, "utf8") : LESSONS_HEADER).replace(/\n*$/, "").split("\n");
  for (const { rule, scope } of lessons) {
    const heading = `## ${scope === "all" ? ALL : scope}`;
    const bullet = `- ${oneLine(rule)} (from ${source})`;
    let at = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase());
    if (at === -1) {
      lines.push("", heading);
      at = lines.length - 1;
    }
    // After the section's last bullet (and its indented continuation), so notes around it stay put.
    let end = at + 1;
    while (end < lines.length && !lines[end].startsWith("## ")) end++;
    let last = -1;
    for (let i = at + 1; i < end; i++) if (/^- \S/.test(lines[i])) last = i;
    if (last === -1) {
      lines.splice(at + 1, 0, "", bullet);
    } else {
      while (last + 1 < end && /^\s+\S/.test(lines[last + 1])) last++;
      lines.splice(last + 1, 0, bullet);
    }
  }
  writeFileSync(path, lines.join("\n") + "\n");
}

export function addImprovements(ws, items, source) {
  const path = join(ws, IMPROVEMENTS_FILE);
  if (!existsSync(path)) writeFileSync(path, IMPROVEMENTS_HEADER);
  appendFileSync(path, items.map((i) => `\n- ${oneLine(i.rule)} (from ${source})`).join("") + "\n");
}

/** Whether lessons or improvements were already learned from this challenge. */
export function learnedFrom(ws, id) {
  return [LESSONS_FILE, IMPROVEMENTS_FILE].some((f) => {
    const p = join(ws, f);
    return existsSync(p) && readFileSync(p, "utf8").includes(`(from ${id})`);
  });
}

const oneLine = (s) => String(s).replace(/\s+/g, " ").trim();

/**
 * Parse Claude's answer: a JSON object {"items":[{rule, scope, kind, evidence}]}, possibly fenced
 * or surrounded by prose. Invalid items are dropped; scope is "all" or `lang`.
 */
export function parseLearnResult(text, lang) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    return null;
  }
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .filter((i) => i && typeof i.rule === "string" && i.rule.trim())
    .map((i) => ({
      rule: oneLine(i.rule),
      scope: i.scope === "all" ? "all" : lang,
      kind: i.kind === "tool" ? "tool" : "lesson",
      evidence: oneLine(i.evidence ?? ""),
    }));
}

/**
 * A pre-filled "lesson" issue (see .github/ISSUE_TEMPLATE/lesson.yml). Only the general rule, the
 * challenge's shape and a short evidence summary: never the user's code.
 */
export function issueUrl(item, manifest, version = "") {
  const params = new URLSearchParams({
    template: "lesson.yml",
    title: `[lesson] ${item.rule.length > 80 ? `${item.rule.slice(0, 79)}…` : item.rule}`,
    rule: item.rule,
    kind: item.kind === "tool" ? "gingaloop itself (validator, runner, prompts)" : "challenge generation (prompt rule)",
    evidence: item.evidence.slice(0, 1500),
    context: `${manifest.lang} · L${manifest.level} · ${manifest.type ?? "implement"}${manifest.area ? ` · ${manifest.area}` : ""}`,
    ...(version ? { version } : {}),
  });
  return `${ISSUES_URL}?${params}`;
}

/** The rule sections of the generation prompt (test design, quality bar): what the generator already knows. */
export function builtInRules(generatePrompt) {
  const start = generatePrompt.indexOf("# Test design");
  const end = generatePrompt.indexOf("\n# Profile conventions");
  return start === -1 ? "" : generatePrompt.slice(start, end === -1 ? undefined : end).trim();
}

/** The prompt for `ginga learn`. */
export function learnPrompt({ review, readme, manifest, lang, existing, builtIn = "" }) {
  return `You turn a code review of a generated practice challenge into lessons for the GENERATOR that
wrote it, so the same kind of mistake does not happen again.

The challenge (${lang}, level ${manifest.level}, type ${manifest.type ?? "implement"}) was written by
an AI following a generation prompt: README.md (the contract), starter/, tests/, a reference
solution and bug variants. The user then solved it and asked for the review below.

Keep ONLY problems the generator caused, for example: a wrong or fragile reference solution; a
promise in README.md that no test checks; an ambiguous or inconsistent README; a starter or bug
variant that does not do what its type requires; misleading hints or explanation. IGNORE everything
about the user's own code (style, idioms, their bugs): that is feedback for the user, not the
generator. If nothing qualifies, return an empty list.

For each problem write ONE rule that is general (it must help future challenges on other topics,
not just this one), actionable by the generator, and verifiable, in at most two sentences. Name the
concrete trap in it (e.g. "add before reducing loses precision above 2^53") rather than a
platitude ("be careful with numbers").

- "scope": "all" when the rule applies to every language, else "${lang}".
- "kind": "tool" when only a change to the tool itself would reliably prevent it (e.g. the
  validator should reject something automatically); otherwise "lesson".
- "evidence": one or two sentences on what went wrong in this challenge, without quoting the
  user's code.

Do not repeat a rule that the generator already has: the built-in rules or the existing lessons
below (rephrased counts as a repeat). If the challenge broke a built-in rule, return nothing for it:
the rule exists, and repeating it adds nothing.

Answer with ONLY this JSON, no prose:
{"items":[{"rule":"…","scope":"all|${lang}","kind":"lesson|tool","evidence":"…"}]}

## Built-in rules of the generation prompt
${builtIn || "(not available)"}

## Existing lessons
${existing || "(none)"}

## README.md of the challenge
${readme}

## The review
${review}
`;
}
