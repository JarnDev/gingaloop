// Which language the daily challenge uses.
// - "random" (default): a shuffle bag. Each cycle draws every rotation language once, in random
//   order, without repeats; when all have been drawn, the bag refills.
// - "ordered": the rotation list in order, continuing after the last daily language, so days
//   without a run don't skip languages.
// State is derived from progress.jsonl (daily "generated" events); review challenges don't draw.
//
// Anchors (`daily.anchors`) come every day and stay out of the bag. Without anchors the daily makes
// one pick from the bag, as always. Extras (`daily.extraChance`, `daily.extraMax`) come on top,
// drawn from the same bag, never a language already made that day.
import { createHash, randomInt } from "node:crypto";
import { DEFAULT_CONFIG } from "./workspace.mjs";

export const ROTATION_MODES = ["random", "ordered"];

function dailyDraws(events, rotation) {
  const inRotation = new Set(rotation);
  return events.filter((e) => e.type === "generated" && e.source === "daily" && !e.reviewOf && e.slot !== "anchor" && inRotation.has(e.lang));
}

/** Languages drawn in the current random cycle, and those still in the bag. */
export function bagState(events, rotation) {
  let drawn = [];
  for (const e of dailyDraws(events, rotation)) {
    if (!drawn.includes(e.lang)) drawn.push(e.lang);
    if (drawn.length >= rotation.length) drawn = [];
  }
  return { drawn, remaining: rotation.filter((l) => !drawn.includes(l)) };
}

/** Next language in ordered mode: the one after the last daily language. */
export function nextOrdered(events, rotation) {
  const last = dailyDraws(events, rotation).at(-1);
  if (!last) return rotation[0];
  return rotation[(rotation.indexOf(last.lang) + 1) % rotation.length];
}

/** The daily settings: anchors limited to the rotation, and the bag (the rest of the rotation). */
export function dailySettings(config, rotation) {
  const d = { ...DEFAULT_CONFIG.daily, ...config.daily };
  const anchors = rotation.filter((l) => d.anchors.includes(l));
  return { anchors, pool: rotation.filter((l) => !anchors.includes(l)), extraChance: d.extraChance, extraMax: d.extraMax };
}

/**
 * How many extras `date` rolled. Each of the `max` slots comes with probability `chance`, decided by
 * a hash of the date: running daily again the same day (or on another machine) rolls the same.
 */
export function extrasRolled(date, chance, max) {
  let n = 0;
  for (let i = 0; i < max; i++) {
    const roll = createHash("sha256").update(`${date}#${i}`).digest().readUInt32BE(0) / 2 ** 32;
    if (roll < chance) n++;
  }
  return n;
}

/**
 * Draw `n` languages from `pool` in the rotation order (`mode`), skipping `taken` (already made
 * today) and each other. Fewer when the pool runs out.
 */
export function drawLangs(events, pool, mode, n, taken = [], rand = randomInt) {
  const out = [];
  let evts = events;
  while (out.length < n) {
    const skip = new Set([...taken, ...out]);
    let lang;
    if (mode === "ordered") {
      const start = pool.indexOf(nextOrdered(evts, pool));
      lang = pool.map((_, i) => pool[(start + i) % pool.length]).find((l) => !skip.has(l));
    } else {
      const candidates = bagState(evts, pool).remaining.filter((l) => !skip.has(l));
      lang = candidates.length ? candidates[rand(candidates.length)] : undefined;
    }
    if (!lang) break;
    out.push(lang);
    evts = [...evts, { type: "generated", source: "daily", lang }];
  }
  return out;
}
