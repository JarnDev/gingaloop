// Challenge types. Each has a minimum level, a weight for the daily mix (implement keeps ≥ 50%
// at every level), extra README sections the validator requires, and the dirs `ginga open` shows
// besides README + starter/. The detailed authoring rules for the non-classic types live in
// prompts/types/<type>.md.

export const TYPES = {
  implement: { minLevel: 1, weight: 50, readme: [], open: [] },
  "fix-the-bug": { minLevel: 1, weight: 8, readme: [], open: [] },
  refactor: { minLevel: 1, weight: 6, readme: [], open: [] },
  extend: { minLevel: 1, weight: 6, readme: [], open: [] },
  "write-the-tests": { minLevel: 1, weight: 8, readme: ["Subject", "What to test"], open: ["subject"], grader: "mutation" },
  trace: { minLevel: 1, weight: 6, readme: ["Program", "Answer format"], open: ["program"] },
  port: { minLevel: 2, weight: 5, readme: ["Source"], open: ["source"], needsSecondLanguage: true },
  "debug-from-symptom": { minLevel: 3, weight: 6, readme: ["Symptom"], open: [] },
  optimize: { minLevel: 3, weight: 5, readme: ["Budget"], open: [], grader: "budget" },
};

export const TYPE_IDS = Object.keys(TYPES);
// Types whose bug variants are implementations, so one must be a plausible different approach.
export const CODE_TYPES = new Set(["implement", "fix-the-bug", "refactor", "extend", "port", "debug-from-symptom", "optimize", "write-the-tests"]);

// port: languages that don't make sense to port from or to, and families of languages that share
// semantics (porting inside a family teaches little). Unlisted languages are their own family.
export const NO_PORT = new Set(["sql", "react"]);
const FAMILY = { javascript: "js", typescript: "js", nodejs: "js", c: "c", cpp: "c", python: "python" };
export const familyOf = (id) => FAMILY[id] ?? id;

/**
 * Source language for a port into `targetId`, or null when port isn't available. Candidates are
 * the other rotation languages with their earned levels; only those at or above port's minimum
 * level qualify (you should read the source fluently). A different family is preferred, then the
 * highest level, then the id.
 */
export function choosePortSource(targetId, candidates, minLevel = TYPES.port.minLevel) {
  if (NO_PORT.has(targetId)) return null;
  const qualified = candidates.filter((c) => c.id !== targetId && !NO_PORT.has(c.id) && c.level >= minLevel);
  if (!qualified.length) return null;
  const far = qualified.filter((c) => familyOf(c.id) !== familyOf(targetId));
  const pool = far.length ? far : qualified;
  return pool.sort((a, b) => b.level - a.level || a.id.localeCompare(b.id))[0].id;
}

export function typeInfo(type) {
  return TYPES[type] ?? TYPES.implement;
}

/** Types available at `level` (port also needs a second language in the rotation). */
export function eligibleTypes(level, { canPort = false } = {}) {
  return TYPE_IDS.filter((t) => TYPES[t].minLevel <= level && (!TYPES[t].needsSecondLanguage || canPort));
}

/**
 * Next type for a language: the eligible type most behind its weight (count / weight smallest),
 * so the mix converges to the weights without randomness. Older events without a recorded
 * challenge type count as implement.
 */
export function pickType(events, lang, level, { canPort = false } = {}) {
  const counts = Object.fromEntries(TYPE_IDS.map((t) => [t, 0]));
  for (const e of events) {
    if (e.type === "generated" && e.lang === lang) counts[e.challengeType ?? "implement"] = (counts[e.challengeType ?? "implement"] ?? 0) + 1;
  }
  const options = eligibleTypes(level, { canPort });
  return options.reduce((best, t) => {
    const r = counts[t] / TYPES[t].weight;
    const b = counts[best] / TYPES[best].weight;
    return r < b || (r === b && TYPES[t].weight > TYPES[best].weight) ? t : best;
  });
}
