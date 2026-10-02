import assert from "node:assert/strict";
import { test } from "node:test";

type WordCount = readonly [word: string, count: number];
const { topWords }: { topWords: (text: string, limit: number) => WordCount[] } = await import(
  `../${process.env.TARGET ?? "starter"}/solution.ts`
);

test("ranks by count descending", () => {
  assert.deepEqual(topWords("a b b c c c", 3), [["c", 3], ["b", 2], ["a", 1]]);
});

test("counts words case-insensitively", () => {
  assert.deepEqual(topWords("the cat and THE hat", 2), [["the", 2], ["and", 1]], '"THE" and "the" are the same word, reported in lowercase');
});

test("ties are ordered alphabetically", () => {
  assert.deepEqual(topWords("b a c b a", 10), [["a", 2], ["b", 2], ["c", 1]], "equal counts must be sorted a→z, not by first appearance");
});

test("apostrophes stay inside words, punctuation splits", () => {
  assert.deepEqual(topWords("don't stop, don't!", 1), [["don't", 2]]);
});

test("digits are separators", () => {
  assert.deepEqual(topWords("abc123abc", 5), [["abc", 2]]);
});

test("respects the limit, including zero", () => {
  assert.equal(topWords("a b c d", 2).length, 2);
  assert.deepEqual(topWords("a b c", 0), []);
  assert.deepEqual(topWords("", 5), []);
});

test("handles a large text quickly", () => {
  const words = Array.from({ length: 200_000 }, (_, i) => `w${String.fromCharCode(97 + (i % 26))}x`).join(" ");
  const start = performance.now();
  const top = topWords(words.replaceAll(/\d/g, ""), 3);
  assert.equal(top.length, 3);
  assert.ok(performance.now() - start < 3000, "should be close to linear");
});
