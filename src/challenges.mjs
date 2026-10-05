// Published challenges in a workspace: listing, locking, unlocking, index.
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { challengeStatus, readEvents } from "./progress.mjs";
import { BUGS_FILE, readManifest } from "./runner.mjs";
import { LOCK_FILE, collectFiles, encryptBundle, normalizeReadme, parseHints, readBundle, writeFiles } from "./vault.mjs";
import { UserError, writeJson } from "./workspace.mjs";

export const LOCKED_PARTS = ["solution", "bugs", "hints.md"];

export function challengesDir(ws) {
  return join(ws, "challenges");
}

export function listChallenges(ws) {
  const root = challengesDir(ws);
  if (!existsSync(root)) return [];
  const out = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (!existsSync(join(dir, "challenge.json"))) continue;
    try {
      const manifest = readManifest(dir);
      out.push({ dir, manifest: { ...manifest, id: manifest.id ?? name } });
    } catch (e) {
      console.error(`ginga: skipping ${name}: unreadable challenge.json (${e.message})`);
    }
  }
  return out;
}

/** Challenges in creation order (from the event log), unknown ones by name first. */
export function byCreation(all, events) {
  const order = new Map();
  events.forEach((e, i) => {
    if (e.type === "generated" && !order.has(e.id)) order.set(e.id, i);
  });
  return [...all].sort((a, b) => (order.get(a.manifest.id) ?? -1) - (order.get(b.manifest.id) ?? -1));
}

/** By exact id, unique prefix, or else the most recently created open challenge (or newest). */
export function pickChallenge(ws, idOrPrefix) {
  const events = readEvents(ws);
  const all = byCreation(listChallenges(ws), events);
  if (all.length === 0) throw new UserError("No challenges yet. Run `ginga new <lang>` or `ginga daily`.");
  if (idOrPrefix) {
    const exact = all.find((c) => c.manifest.id === idOrPrefix);
    if (exact) return exact;
    const hits = all.filter((c) => c.manifest.id.startsWith(idOrPrefix));
    if (hits.length === 1) return hits[0];
    if (hits.length === 0) throw new UserError(`No challenge matches "${idOrPrefix}".`);
    throw new UserError(`"${idOrPrefix}" is ambiguous: ${hits.map((h) => h.manifest.id).join(", ")}`);
  }
  const open = all.filter((c) => challengeStatus(events, c.manifest.id).status === "open");
  return (open.length ? open : all).at(-1);
}

export function isLocked(dir) {
  return existsSync(join(dir, LOCK_FILE));
}

/**
 * Encrypt solution/, bugs/ and hints.md with the README key, then delete the plaintext.
 * The bug list (names + expected failing tests) moves from challenge.json into the bundle,
 * since it spoils the common mistakes. README.md becomes read-only: it is the key.
 */
export function lockChallenge(dir) {
  const manifest = readManifest(dir);
  if (manifest.bugs) {
    mkdirSync(join(dir, "bugs"), { recursive: true });
    writeJson(join(dir, BUGS_FILE), manifest.bugs);
    delete manifest.bugs;
    writeJson(join(dir, "challenge.json"), manifest);
  }
  const readme = Buffer.from(normalizeReadme(readFileSync(join(dir, "README.md"), "utf8")));
  writeFileSync(join(dir, "README.md"), readme);
  const files = collectFiles(dir, LOCKED_PARTS);
  writeFileSync(join(dir, LOCK_FILE), encryptBundle(files, readme));
  for (const part of LOCKED_PARTS) rmSync(join(dir, part), { recursive: true, force: true });
  chmodSync(join(dir, "README.md"), 0o444);
}

/** Decrypt into the challenge dir and remove the lock file. */
export function unlockChallenge(dir) {
  if (!isLocked(dir)) return false;
  writeFiles(dir, readBundle(dir));
  rmSync(join(dir, LOCK_FILE));
  return true;
}

/** Hints for a challenge, whether locked or already unlocked. */
export function readHints(dir) {
  if (isLocked(dir)) {
    const bundle = readBundle(dir);
    return parseHints(bundle["hints.md"]?.toString("utf8") ?? "");
  }
  const p = join(dir, "hints.md");
  return existsSync(p) ? parseHints(readFileSync(p, "utf8")) : [];
}

/**
 * Editor/debugger helper files from the profile (e.g. compile_flags.txt for clangd and autodap,
 * mirroring the sandbox flags). Plain file names only; existing files are kept unless `overwrite`,
 * so a user's tweaks survive. Returns the names written.
 */
export function writeEditorFiles(dir, profile, { overwrite = false } = {}) {
  const written = [];
  for (const [name, content] of Object.entries(profile.editorFiles ?? {})) {
    if (!/^[\w.-]+$/.test(name) || name === "." || name === "..") {
      throw new UserError(`Profile ${profile.id}: editorFiles name "${name}" must be a plain file name.`);
    }
    const p = join(dir, name);
    if (existsSync(p) && !overwrite) continue;
    writeFileSync(p, String(content));
    written.push(name);
  }
  return written;
}

export function writeIndex(ws) {
  const events = readEvents(ws);
  const icon = { open: "⬜", solved: "✅", gaveup: "🟥" };
  const rows = listChallenges(ws)
    .reverse()
    .map(({ manifest: m }) => {
      const s = challengeStatus(events, m.id);
      return `| ${m.date} | ${m.lang} | L${m.level} | [${m.title}](challenges/${m.id}/README.md) | ${m.type} | ${icon[s.status]} ${s.status} |`;
    });
  writeFileSync(
    join(ws, "INDEX.md"),
    [
      "# Challenges",
      "",
      "Generated by `ginga`; do not edit by hand.",
      "",
      "| Date | Lang | Level | Challenge | Type | Status |",
      "|---|---|---|---|---|---|",
      ...rows,
      "",
    ].join("\n"),
  );
}
