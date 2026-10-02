import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const { countLines } = await import(`../${process.env.TARGET ?? "starter"}/solution.mjs`);

let dir;
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "count-lines-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function fileWith(name, contents) {
  const path = join(dir, name);
  await writeFile(path, contents);
  return path;
}

test("counts newline-terminated lines", { timeout: 5000 }, async () => {
  assert.equal(await countLines(await fileWith("a.txt", "a\nb\n")), 2);
});

test("counts a last line without a trailing newline", { timeout: 5000 }, async () => {
  assert.equal(await countLines(await fileWith("b.txt", "a\nb")), 2, '"b" at the end is a line even without "\\n"');
});

test("an empty file has zero lines", { timeout: 5000 }, async () => {
  assert.equal(await countLines(await fileWith("c.txt", "")), 0);
});

test("blank lines count", { timeout: 5000 }, async () => {
  assert.equal(await countLines(await fileWith("d.txt", "\n\n")), 2);
});

test("works across chunk boundaries", { timeout: 10000 }, async () => {
  // 64 KiB is the default highWaterMark: lines here straddle many chunks.
  const line = "x".repeat(1000) + "\n";
  assert.equal(await countLines(await fileWith("e.txt", line.repeat(500) + "tail")), 501);
});

test("a missing file rejects with ENOENT", { timeout: 5000 }, async () => {
  await assert.rejects(countLines(join(dir, "nope.txt")), { code: "ENOENT" });
});
