// Stacks: every profile has a "basics" stack (its bare image: standard library only) and may
// declare an "ecosystem" stack (a second image with pinned libraries such as numpy, pandas,
// pytest or vitest). A challenge records its stack, and runs in that stack's image, so a basics
// challenge physically cannot import a library. Which stack a new challenge gets is set per
// language in gingaloop.json: "stack": { "python": "basics" | "mixed" | "ecosystem" }.
import { randomInt } from "node:crypto";
import { join } from "node:path";
import { PKG_ROOT, UserError } from "./workspace.mjs";

export const STACKS = ["basics", "ecosystem"];
export const STACK_MODES = ["basics", "mixed", "ecosystem"];
// Share of ecosystem challenges in "mixed" mode when the domain says nothing more specific.
export const DEFAULT_ECOSYSTEM_SHARE = 0.3;

export function hasEcosystem(profile) {
  return Boolean(profile?.stacks?.ecosystem);
}

/** The profile as seen by one stack: image, test command, conventions, areas and example. */
export function profileForStack(profile, stack = "basics") {
  const s = stack ?? "basics";
  if (!STACKS.includes(s)) throw new UserError(`Unknown stack "${s}" (use ${STACKS.join(" or ")}).`);
  if (s === "basics") return { ...profile, stack: "basics" };
  const eco = profile.stacks?.ecosystem;
  if (!eco) throw new UserError(`The ${profile.id} profile has no ecosystem stack.`);
  return {
    ...profile,
    stack: "ecosystem",
    image: eco.image,
    testCommand: eco.testCommand ?? profile.testCommand,
    successPattern: eco.successPattern !== undefined ? eco.successPattern : profile.successPattern,
    conventions: `${profile.conventions}\n\nECOSYSTEM STACK (this challenge): ${eco.conventions}`,
    areas: [...(profile.areas ?? []), ...(eco.areas ?? []).map((a) => ({ ...a, stack: "ecosystem" }))],
    exampleDir:
      profile.source === "builtin" ? join(PKG_ROOT, "examples", `${profile.id}.ecosystem`) : `${profile.exampleDir}.ecosystem`,
    libraries: eco.libraries ?? [],
  };
}

export function stackMode(config, langId) {
  const mode = config.stack?.[langId] ?? "basics";
  if (!STACK_MODES.includes(mode)) throw new UserError(`gingaloop.json: stack.${langId} must be one of ${STACK_MODES.join(", ")}.`);
  return mode;
}

/**
 * Stack for a new challenge. basics is an absolute guarantee: no domain or area pulls libraries
 * in. In mixed mode, `share` (from the domain) is the probability of an ecosystem challenge.
 */
export function pickStack(profile, mode, { share = DEFAULT_ECOSYSTEM_SHARE, rand = () => randomInt(1_000_000) / 1_000_000 } = {}) {
  if (!hasEcosystem(profile) || mode === "basics") return "basics";
  if (mode === "ecosystem") return "ecosystem";
  return rand() < share ? "ecosystem" : "basics";
}
