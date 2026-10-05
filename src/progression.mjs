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
    promotion: config.leveling?.promotion ?? true,
    promotionRetryDays: config.leveling?.promotionRetryDays ?? 3,
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
  if (g.promotionPending) {
    return g.promotionRetryOn ? `promotion: next attempt from ${g.promotionRetryOn}` : "promotion challenge next";
  }
  const parts = [];
  if (g.areasMissing.length) parts.push(`missing areas: ${g.areasMissing.join(", ")}`);
  if (g.streak < g.streakNeeded) parts.push(`clean streak ${g.streak}/${g.streakNeeded}`);
  return parts.join(" · ");
}

/**
 * Areas for a promotion challenge: 2–3 areas you've solved cleanly at this level, least recently
 * practiced first (so the promotion revisits what you might be forgetting).
 */
export function promotionAreas(events, lang, level, count = 3) {
  const areaOf = new Map(events.filter((e) => e.type === "generated" && e.area).map((e) => [e.id, e.area]));
  const lastSeen = new Map();
  for (const e of events) {
    if (e.type === "solved" && e.lang === lang && e.level === level && (e.hints ?? 0) <= 1 && !e.afterGiveup && areaOf.has(e.id)) {
      lastSeen.set(areaOf.get(e.id), e.ts ?? "");
    }
  }
  return [...lastSeen].sort((a, b) => a[1].localeCompare(b[1])).slice(0, count).map(([area]) => area);
}

/** Should the next challenge in `lang` be a promotion? (pending, not on cool-down, none open) */
export function promotionDue(state, events, lang, today, openIds) {
  const g = state.gates;
  if (!g?.promotionPending) return false;
  if (g.promotionRetryOn && today < g.promotionRetryOn) return false;
  return !events.some((e) => e.type === "generated" && e.lang === lang && e.promotion && openIds.has(e.id));
}
