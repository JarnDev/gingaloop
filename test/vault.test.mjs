import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { isLocked, lockChallenge, readHints, unlockChallenge } from "../src/challenges.mjs";
import { VaultKeyError, decryptBundle, decryptBundleTolerant, encryptBundle, normalizeReadme, parseHints, writeFiles } from "../src/vault.mjs";

const tmp = mkdtempSync(join(tmpdir(), "gingaloop-vault-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

const MARKER = "SECRET_SOLUTION_MARKER_42";

function makeChallenge(name) {
  const dir = join(tmp, name);
  mkdirSync(join(dir, "solution"), { recursive: true });
  mkdirSync(join(dir, "bugs", "b1"), { recursive: true });
  writeFileSync(join(dir, "README.md"), "# Problem\nDo the thing.\n");
  writeFileSync(join(dir, "challenge.json"), JSON.stringify({ slug: name, bugs: [{ name: "b1", expect: "SPOILER_TEST_NAME" }] }));
  writeFileSync(join(dir, "solution", "solution.py"), `# ${MARKER}\n`);
  writeFileSync(join(dir, "solution", "EXPLANATION.md"), "## Approach\n");
  writeFileSync(join(dir, "bugs", "b1", "solution.py"), "# buggy\n");
  writeFileSync(join(dir, "hints.md"), "## Hint 1\none\n\n## Hint 2\ntwo\n\n## Hint 3\nthree\n");
  return dir;
}

function grepTree(dir, needle) {
  const hits = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (readFileSync(p).includes(needle)) hits.push(p);
    }
  };
  walk(dir);
  return hits;
}

test("round trip with the README bytes as key", () => {
  const readme = Buffer.from("# hello\n");
  const files = { "solution/a.txt": Buffer.from("x"), "bugs/b/a.txt": Buffer.from([0, 255, 10]) };
  assert.deepEqual(decryptBundle(encryptBundle(files, readme), readme), files);
});

test("a changed README cannot unlock (one byte is enough)", () => {
  const blob = encryptBundle({ "a": Buffer.from("x") }, Buffer.from("# hello\n"));
  assert.throws(() => decryptBundle(blob, Buffer.from("# hello!\n")), VaultKeyError);
  assert.throws(() => decryptBundle(blob, Buffer.from("# hello\r\n")), VaultKeyError, "CRLF conversion must break it too");
});

test("a tampered lock file fails the GCM check", () => {
  const readme = Buffer.from("r");
  const blob = encryptBundle({ "a": Buffer.from("payload") }, readme);
  blob[blob.length - 1] ^= 1;
  assert.throws(() => decryptBundle(blob, readme), VaultKeyError);
  assert.throws(() => decryptBundle(Buffer.from("nope"), readme), VaultKeyError);
});

test("lock removes every plaintext copy; unlock restores it", () => {
  const dir = makeChallenge("c1");
  lockChallenge(dir);
  assert.ok(isLocked(dir));
  for (const p of ["solution", "bugs", "hints.md"]) assert.ok(!existsSync(join(dir, p)), `${p} must be gone`);
  assert.deepEqual(grepTree(dir, MARKER), [], "no plaintext solution may remain after locking");
  assert.deepEqual(grepTree(dir, "SPOILER_TEST_NAME"), [], "the bug list moves out of challenge.json into the lock");
  assert.equal(statSync(join(dir, "README.md")).mode & 0o222, 0, "README (the key) becomes read-only");
  assert.deepEqual(readHints(dir), ["one", "two", "three"]);
  assert.ok(unlockChallenge(dir));
  assert.ok(!isLocked(dir));
  assert.ok(readFileSync(join(dir, "solution", "solution.py"), "utf8").includes(MARKER));
  assert.equal(readFileSync(join(dir, "bugs", "b1", "solution.py"), "utf8"), "# buggy\n");
  assert.ok(readFileSync(join(dir, "bugs", "bugs.json"), "utf8").includes("SPOILER_TEST_NAME"));
});

test("editing the README after locking blocks unlock with a helpful message", () => {
  const dir = makeChallenge("c2");
  lockChallenge(dir);
  chmodSync(join(dir, "README.md"), 0o644);
  writeFileSync(join(dir, "README.md"), "# Problem\nDo the thing, edited.\n");
  assert.throws(() => unlockChallenge(dir), /README\.md changed/);
  assert.ok(isLocked(dir), "a failed unlock keeps the lock file");
});

test("parseHints splits on '## Hint N' headings", () => {
  assert.deepEqual(parseHints("intro\n## Hint 1\na\n## Hint 2 (approach)\nb\nmore\n## hint 3\nc"), ["a", "b\nmore", "c"]);
});

test("unlock survives editor whitespace/line-ending changes, not content edits", () => {
  const readme = Buffer.from(normalizeReadme("# Title  \r\n\r\nSome text.  \nMore.\n\n\n"));
  assert.equal(readme.toString(), "# Title\n\nSome text.\nMore.\n", "published READMEs are canonical");
  const blob = encryptBundle({ a: Buffer.from("x") }, readme);
  for (const variant of [
    "# Title\r\n\r\nSome text.\r\nMore.\r\n", // CRLF
    "# Title \n\nSome text.   \nMore.\n", // trailing spaces added
    "# Title\n\nSome text.\nMore.", // final newline removed
    "# Title\n\nSome text.\nMore.\n\n", // extra newline added
  ]) {
    assert.deepEqual(decryptBundleTolerant(blob, Buffer.from(variant)).a, Buffer.from("x"), JSON.stringify(variant));
  }
  assert.throws(() => decryptBundleTolerant(blob, Buffer.from("# Title\n\nOther text.\nMore.\n")), VaultKeyError);
});

test("writeFiles refuses absolute paths, '..' and symlinks", () => {
  const root = join(tmp, "wf");
  mkdirSync(root, { recursive: true });
  assert.throws(() => writeFiles(root, { "/etc/x": Buffer.from("") }), /unsafe/);
  assert.throws(() => writeFiles(root, { "a/../../x": Buffer.from("") }), /unsafe/);
  const outside = join(tmp, "outside");
  mkdirSync(outside, { recursive: true });
  symlinkSync(outside, join(root, "solution"));
  assert.throws(() => writeFiles(root, { "solution/s.py": Buffer.from("pwn") }), /symlink/);
  assert.ok(!existsSync(join(outside, "s.py")));
});
