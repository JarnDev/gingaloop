// Topic coverage map: practice areas per language (generic + profile-specific), and which
// ones you've had challenges in. Generation targets the least-covered unlocked area.
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PKG_ROOT } from "./workspace.mjs";

let generic;
export function genericAreas() {
  generic ??= JSON.parse(readFileSync(join(PKG_ROOT, "prompts", "areas.json"), "utf8")).areas;
  return generic;
}

/** All areas for a profile (profile areas first; they override generic ones with the same id). */
export function allAreas(profile) {
  const byId = new Map();
  for (const a of profile.areas ?? []) byId.set(a.id, { ...a, specific: true });
  for (const a of genericAreas()) if (!byId.has(a.id)) byId.set(a.id, { ...a, specific: false });
  return [...byId.values()];
}

/** Areas unlocked at `level`. An ecosystem challenge targets the ecosystem areas when there are any. */
export function unlockedAreas(profile, level) {
  const open = allAreas(profile).filter((a) => (a.minLevel ?? 1) <= level);
  if (profile.stack === "ecosystem") {
    const eco = open.filter((a) => a.stack === "ecosystem");
    if (eco.length) return eco;
  }
  return open.filter((a) => a.stack !== "ecosystem");
}

/** Challenges generated per area in one language. */
export function coverageCounts(events, lang) {
  const counts = new Map();
  for (const e of events) {
    if (e.type === "generated" && e.lang === lang && e.area) counts.set(e.area, (counts.get(e.area) ?? 0) + 1);
  }
  return counts;
}

/** Least-covered unlocked area; ties broken at random. */
export function pickArea(profile, level, events, rand = randomInt) {
  const areas = unlockedAreas(profile, level);
  const counts = coverageCounts(events, profile.id);
  const min = Math.min(...areas.map((a) => counts.get(a.id) ?? 0));
  const candidates = areas.filter((a) => (counts.get(a.id) ?? 0) === min);
  return candidates[rand(candidates.length)];
}

export function findArea(profile, id) {
  return allAreas(profile).find((a) => a.id === id) ?? null;
}
