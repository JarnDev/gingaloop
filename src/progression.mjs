// Mastery gates for leveling up, per language: which areas must be covered (the stack the language
// practices decides basics vs ecosystem areas), how many clean solves in a row, and since when the
// gates apply (levels earned before keep counting).
import { unlockedAreas } from "./coverage.mjs";
import { levelState } from "./levels.mjs";
import { findProfile } from "./profiles.mjs";
import { hasEcosystem, profileForStack, stackMode } from "./stacks.mjs";

// Gates apply to level-ups from this moment on; levels earned by points alone before are kept.
export const GATES_SINCE = "2026-10-05T15:00:00.000Z";

export function levelGate(ws, config, lang) {
  const base = findProfile(ws, lang);
  if (!base) return null;
  const stack = hasEcosystem(base) && stackMode(config, base.id) === "ecosystem" ? "ecosystem" : "basics";
  const profile = profileForStack(base, stack);
  return {
    areasAt: (level) => unlockedAreas(profile, level).map((a) => a.id),
    cleanStreak: config.leveling?.cleanStreak ?? 3,
    since: GATES_SINCE,
  };
}

/** Level state for a language with the mastery gates applied. */
export function langLevel(ws, config, events, lang) {
  return levelState(events, lang, config.leveling, levelGate(ws, config, lang));
}

/** "areas 3/4 (missing: hashing) · clean streak 1/3" for the next level, or "" when not blocked. */
export function gateSummary(state) {
  const g = state.gates;
  if (!g) return "";
  const parts = [];
  if (g.areasMissing.length) parts.push(`missing areas: ${g.areasMissing.join(", ")}`);
  if (g.streak < g.streakNeeded) parts.push(`clean streak ${g.streak}/${g.streakNeeded}`);
  return parts.join(" · ");
}
