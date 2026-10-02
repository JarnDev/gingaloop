// Locked solutions. The key is SHA-256 of the challenge's README.md bytes:
// no stored keys, and editing the description invalidates the lock.
// This is anti-spoiler friction, not security: anyone with the README can derive the key.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { UserError } from "./workspace.mjs";

const MAGIC = Buffer.from("GLV1");
export const LOCK_FILE = "locked.bin";

export class VaultKeyError extends UserError {}

export function keyFromReadme(readmeBytes) {
  return createHash("sha256").update(readmeBytes).digest();
}

/** Collect files under `dirs` (relative to root) into { "rel/path": Buffer }. */
export function collectFiles(root, dirs) {
  const out = {};
  const walk = (abs) => {
    const st = statSync(abs, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) {
      for (const name of readdirSync(abs)) walk(join(abs, name));
    } else if (st.isFile()) {
      out[relative(root, abs).split(sep).join("/")] = readFileSync(abs);
    }
  };
  for (const d of dirs) walk(join(root, d));
  return out;
}

export function encryptBundle(files, readmeBytes) {
  const payload = Buffer.from(
    JSON.stringify({
      v: 1,
      files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.toString("base64")])),
    }),
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromReadme(readmeBytes), iv);
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

/**
 * Canonical README text: LF line endings, no trailing whitespace, exactly one final newline.
 * READMEs are normalized at publish, so the usual editor "fixes" (strip trailing spaces, add a
 * final newline, CRLF) can be undone at unlock time by normalizing again.
 */
export function normalizeReadme(text) {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n*$/, "\n");
}

/** Keys to try when unlocking: the bytes as they are, then their canonical form. */
export function readmeVariants(readmeBytes) {
  const canon = Buffer.from(normalizeReadme(readmeBytes.toString("utf8")));
  return canon.equals(readmeBytes) ? [readmeBytes] : [readmeBytes, canon];
}

export function decryptBundleTolerant(blob, readmeBytes) {
  let last;
  for (const variant of readmeVariants(readmeBytes)) {
    try {
      return decryptBundle(blob, variant);
    } catch (e) {
      if (!(e instanceof VaultKeyError)) throw e;
      last = e;
    }
  }
  throw last;
}

export function decryptBundle(blob, readmeBytes) {
  if (blob.length < 32 || !blob.subarray(0, 4).equals(MAGIC)) {
    throw new VaultKeyError("locked.bin is not a gingaloop lock file.");
  }
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const decipher = createDecipheriv("aes-256-gcm", keyFromReadme(readmeBytes), iv);
  decipher.setAuthTag(tag);
  let plain;
  try {
    plain = Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]);
  } catch {
    throw new VaultKeyError(
      "Cannot unlock: README.md changed since the challenge was generated (it is the key). " +
        "Restore it, e.g. `git checkout -- README.md`, and try again.",
    );
  }
  const { files } = JSON.parse(plain.toString("utf8"));
  return Object.fromEntries(Object.entries(files).map(([k, v]) => [k, Buffer.from(v, "base64")]));
}

export function readBundle(challengeDir) {
  return decryptBundleTolerant(
    readFileSync(join(challengeDir, LOCK_FILE)),
    readFileSync(join(challengeDir, "README.md")),
  );
}

export function writeFiles(root, files) {
  for (const [rel, buf] of Object.entries(files)) {
    const parts = rel.split("/");
    if (isAbsolute(rel) || parts.includes("..") || parts.includes("")) throw new Error(`Refusing unsafe path in bundle: ${rel}`);
    // Never write through a symlink (e.g. a cloned challenge with solution -> ~/somewhere).
    let cur = root;
    for (const part of parts) {
      cur = join(cur, part);
      const st = lstatSync(cur, { throwIfNoEntry: false });
      if (st?.isSymbolicLink()) throw new UserError(`Refusing to write through symlink ${cur}`);
    }
    const abs = join(root, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, buf);
  }
}

/** Split hints.md into an ordered list of hints ("## Hint 1", "## Hint 2", ...). */
export function parseHints(text) {
  return text
    .split(/^##\s+Hint\s+\d+[^\n]*\n/im)
    .slice(1)
    .map((h) => h.trim())
    .filter(Boolean);
}
