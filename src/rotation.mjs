// Which language the daily challenge uses.
// - "random" (default): a shuffle bag. Each cycle draws every rotation language once, in random
//   order, without repeats; when all have been drawn, the bag refills.
// - "ordered": the rotation list in order, continuing after the last daily language, so days
//   without a run don't skip languages.
// State is derived from progress.jsonl (daily "generated" events); review challenges don't draw.
import { randomInt } from "node:crypto";

export const ROTATION_MODES = ["random", "ordered"];

function dailyDraws(events, rotation) {
  const inRotation = new Set(rotation);
  return events.filter((e) => e.type === "generated" && e.source === "daily" && !e.reviewOf && inRotation.has(e.lang));
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

export function pickDailyLang(events, rotation, mode = "random", rand = randomInt) {
  if (!rotation.length) throw new Error("rotation is empty");
  if (mode === "ordered") return nextOrdered(events, rotation);
  const { remaining } = bagState(events, rotation);
  return remaining[rand(remaining.length)];
}
