// Industry domains: the framing, realistic data and domain rules of a challenge, on top of the
// language (what you write) and the area (the core skill). Config: "domains": ["general"] by
// default; any other choice still mixes in "general" about 1 in 4 times so fundamentals stay.
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_ECOSYSTEM_SHARE } from "./stacks.mjs";
import { PKG_ROOT, UserError } from "./workspace.mjs";

export const GENERAL = "general";
export const GENERAL_SHARE = 0.25;

let catalog;
export function allDomains() {
  catalog ??= JSON.parse(readFileSync(join(PKG_ROOT, "prompts", "domains.json"), "utf8")).domains;
  return catalog;
}

export function findDomain(id) {
  return allDomains().find((d) => d.id === String(id).trim().toLowerCase()) ?? null;
}

export function requireDomain(id) {
  const d = findDomain(id);
  if (!d) throw new UserError(`Unknown domain "${id}". See \`ginga domains list\`.`);
  return d;
}

/** The configured domains, validated; ["general"] when nothing is set. */
export function configuredDomains(config) {
  const ids = config.domains?.length ? config.domains : [GENERAL];
  return [...new Set(ids.map((id) => requireDomain(id).id))];
}

/**
 * Domain for a new challenge. With only "general" configured, always "general". Otherwise
 * "general" ~1 in 4 times, else a shuffle bag over the configured (non-general) domains: each
 * appears once per cycle, using the domains recorded on earlier "generated" events.
 */
export function pickDomain(events, domains, rand = () => randomInt(1_000_000) / 1_000_000) {
  const specific = domains.filter((d) => d !== GENERAL);
  if (!specific.length) return GENERAL;
  if (rand() < GENERAL_SHARE) return GENERAL;
  let drawn = [];
  for (const e of events) {
    if (e.type !== "generated" || !specific.includes(e.domain)) continue;
    if (!drawn.includes(e.domain)) drawn.push(e.domain);
    if (drawn.length >= specific.length) drawn = [];
  }
  const remaining = specific.filter((d) => !drawn.includes(d));
  return remaining[Math.floor(rand() * remaining.length) % remaining.length];
}

/** Probability of an ecosystem challenge in "mixed" stack mode for this domain. */
export function ecosystemShare(domainId) {
  return findDomain(domainId)?.ecosystemShare ?? DEFAULT_ECOSYSTEM_SHARE;
}

/** Prompt text describing the domain to the generator. */
export function domainBrief(domainId) {
  const d = findDomain(domainId);
  if (!d || d.id === GENERAL) return "general: no industry framing; a classic, self-contained problem.";
  return `${d.name}: ${d.focus}. Typical topics: ${d.topics.join("; ")}. Frame the problem as real work in this ` +
    "industry, with realistic data and the domain's own rules and pitfalls (they make good tests and bug variants), " +
    "while the area above stays the core skill being practiced.";
}
