import assert from "node:assert/strict";
import { test } from "node:test";
import { findDuplicate, slugFromId, tokens } from "../src/dedupe.mjs";

const past = (id, title) => ({ id, lang: "python", title });
const history = [
  past("2026-10-01-python-top-k-words", "Top k words"),
  past("2026-10-01-python-print-page-ranges", "Page ranges for the print dialog"),
  past("2026-10-04-python-ring-buffer-2", "A ring buffer"),
];

test("slugFromId strips date, language and numeric suffix", () => {
  assert.equal(slugFromId("2026-10-04-python-ring-buffer-2", "python"), "ring-buffer");
  assert.equal(slugFromId("2026-10-04-cpp-reverse-words", "cpp"), "reverse-words");
});

test("tokens ignore case, punctuation, filler words and plurals", () => {
  assert.deepEqual([...tokens("The Top-K Words!")], ["top", "k", "word"]);
});

test("same slug is a duplicate, even with a -N suffix", () => {
  assert.equal(findDuplicate({ slug: "top-k-words", title: "Most common words" }, history)?.id, history[0].id);
  assert.equal(findDuplicate({ slug: "ring-buffer-3", title: "Circular queue" }, history)?.id, history[2].id);
});

test("near-exact titles are duplicates", () => {
  assert.ok(findDuplicate({ slug: "print-dialog-page-ranges", title: "Print dialog: page ranges" }, history));
  assert.ok(findDuplicate({ slug: "top-words-k", title: "The top K word" }, history));
});

test("different problems pass", () => {
  assert.equal(findDuplicate({ slug: "word-frequencies", title: "Word frequencies by length" }, history), null);
  assert.equal(findDuplicate({ slug: "lru-cache", title: "LRU cache" }, history), null);
  assert.equal(findDuplicate({ slug: "anything", title: "Anything" }, []), null);
});
