// Earned levels per language, Codewars-style: solves earn points, levels cost points.
// - Only verified solves (`ginga done` ran the tests) earn points; give-ups never do.
// - A solve AT your level earns the full base; below your level earns a sharply smaller share,
//   so farming easy challenges is ~20x slower than playing at your level.
// - Hints scale the points down.
// Levels are recomputed from progress.jsonl, so changing the rules re-scores history.
import { UserError } from "./workspace.mjs";

export function maxLevelFor(leveling) {
  return leveling.thresholds.length + 1;
}

/** Points a solve earns, given the level the solver had at that moment. */
export function pointsFor({ level, hints = 0, afterGiveup = false }, currentLevel, leveling) {
  if (afterGiveup) return 0;
  const gap = currentLevel - level; // > 0: easier than your level
  const share = gap <= 0 ? 1 : (leveling.belowShare[gap - 1] ?? leveling.belowShare.at(-1));
  const hm = leveling.hintMultiplier;
  const mult = hm[Math.min(Math.max(hints, 0), hm.length - 1)];
  return Math.round(leveling.basePoints * share * mult);
}

/**
 * @param {Array<object>} events  progress events in chronological order
 * @returns {{level:number, points:number, nextAt:number|null, needed:number, max:number}}
 */
export function levelState(events, lang, leveling) {
  const { thresholds } = leveling;
  const max = maxLevelFor(leveling);
  let level = 1;
  let points = 0;
  const seen = new Set();
  for (const e of events) {
    if (e.type !== "solved" || e.lang !== lang || seen.has(e.id)) continue;
    seen.add(e.id);
    points += pointsFor(e, level, leveling);
    while (level < max && points >= thresholds[level - 1]) level++;
  }
  const nextAt = level >= max ? null : thresholds[level - 1];
  return { level, points, nextAt, needed: nextAt == null ? 0 : nextAt - points, max };
}

/** Resolve a requested level against the earned one. Never above the earned level. */
export function resolveLevel(requested, state, lang, leveling) {
  if (requested == null) return state.level;
  const n = Number(requested);
  if (!Number.isInteger(n) || n < 1 || n > state.max) {
    throw new UserError(`Level must be an integer between 1 and ${state.max}.`);
  }
  if (n > state.level) {
    const solves = Math.ceil(state.needed / leveling.basePoints);
    throw new UserError(
      `Level ${n} is locked for ${lang}. You are level ${state.level} with ${state.points} points; ` +
        `level ${state.level + 1} needs ${state.needed} more (about ${solves} hint-free ` +
        `level-${state.level} solve${solves === 1 ? "" : "s"}).`,
    );
  }
  return n;
}

/**
 * Daily streak with Duolingo-style freezes, derived from the days with at least one solve.
 * Every 7 consecutive solve days earns a freeze (max 2 held). A missed day uses a freeze
 * instead of breaking the streak. Today without a solve yet doesn't break anything.
 * @param {string[]} solveDays  YYYY-MM-DD local dates (any order, duplicates ok)
 */
export function streakState(solveDays, today, { earnEvery = 7, maxFreezes = 2 } = {}) {
  const days = new Set(solveDays);
  if (days.size === 0) return { days: 0, freezes: 0, frozeOn: [] };
  const first = [...days].sort()[0];
  let streak = 0;
  let freezes = 0;
  let frozeOn = [];
  const d = new Date(first + "T12:00:00Z");
  for (;;) {
    const day = d.toISOString().slice(0, 10);
    if (day > today) break;
    if (days.has(day)) {
      streak++;
      if (streak % earnEvery === 0) freezes = Math.min(maxFreezes, freezes + 1);
    } else if (day !== today) {
      if (freezes > 0 && streak > 0) {
        freezes--;
        frozeOn.push(day);
      } else {
        streak = 0;
        frozeOn = [];
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return { days: streak, freezes, frozeOn };
}
