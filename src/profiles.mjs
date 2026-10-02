// Language profiles: built-in (package profiles/) and bootstrapped (workspace profiles/).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PKG_ROOT, UserError } from "./workspace.mjs";

function readProfilesFrom(dir, source) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
      const exampleDir =
        source === "builtin" ? join(PKG_ROOT, "examples", p.id) : join(dir, `${p.id}.example`);
      return { ...p, source, exampleDir };
    });
}

/** Workspace profiles override built-ins with the same id. */
export function allProfiles(ws) {
  const byId = new Map();
  for (const p of readProfilesFrom(join(PKG_ROOT, "profiles"), "builtin")) byId.set(p.id, p);
  if (ws) for (const p of readProfilesFrom(join(ws, "profiles"), "workspace")) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeLang(name) {
  return String(name).trim().toLowerCase();
}

export function findProfile(ws, name) {
  const key = normalizeLang(name);
  return (
    allProfiles(ws).find((p) => p.id === key || (p.aliases ?? []).map(normalizeLang).includes(key)) ??
    null
  );
}

export function requireProfile(ws, name) {
  const p = findProfile(ws, name);
  if (!p) {
    throw new UserError(
      `No profile for "${name}". Add one with \`ginga lang add ${name}\` ` +
        `(known: ${allProfiles(ws).map((x) => x.id).join(", ")}).`,
    );
  }
  return p;
}

/** Problems with a profile object (used for bootstrapped profiles). */
export function checkProfile(p) {
  const problems = [];
  if (!p || typeof p !== "object") return ["profile is not an object"];
  if (!/^[a-z0-9][a-z0-9+#._-]*$/.test(p.id ?? "")) problems.push("id must be lowercase [a-z0-9+#._-]");
  if (!p.name) problems.push("name is required");
  if (!p.image || !(p.image.pull || (p.image.tag && p.image.dockerfile))) {
    problems.push('image must be { "pull": "<image:tag>" } or { "tag", "dockerfile" }');
  }
  if (!p.testCommand) problems.push("testCommand is required");
  if (!p.conventions) problems.push("conventions is required");
  return problems;
}
