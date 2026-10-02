import assert from "node:assert/strict";
import { test } from "node:test";
import { bagState, nextOrdered, pickDailyLang } from "../src/rotation.mjs";

const daily = (lang, extra = {}) => ({ type: "generated", source: "daily", lang, ...extra });
const ROT = ["python", "c", "rust", "go"];

test("random: draws every language once per cycle, then refills", () => {
  let events = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    const seen = [];
    for (let i = 0; i < ROT.length; i++) {
      const lang = pickDailyLang(events, ROT, "random");
      assert.ok(!seen.includes(lang), `no repeat inside a cycle (cycle ${cycle}: ${seen} + ${lang})`);
      seen.push(lang);
      events = [...events, daily(lang)];
    }
    assert.deepEqual([...seen].sort(), [...ROT].sort());
  }
});

test("random: the pick is uniform over what is left in the bag", () => {
  const events = [daily("python"), daily("rust")];
  assert.deepEqual(bagState(events, ROT), { drawn: ["python", "rust"], remaining: ["c", "go"] });
  assert.equal(pickDailyLang(events, ROT, "random", () => 0), "c");
  assert.equal(pickDailyLang(events, ROT, "random", () => 1), "go");
});

test("reviews, manual challenges and removed languages don't draw from the bag", () => {
  const events = [
    daily("python"),
    daily("c", { reviewOf: "x" }),
    { type: "generated", source: "manual", lang: "rust" },
    daily("elixir"),
  ];
  assert.deepEqual(bagState(events, ROT).remaining, ["c", "rust", "go"]);
});

test("a language added mid-cycle joins the current bag", () => {
  const events = [daily("python"), daily("c")];
  assert.deepEqual(bagState(events, [...ROT, "zig"]).remaining, ["rust", "go", "zig"]);
});

test("ordered: continues after the last daily, so missed days don't skip languages", () => {
  assert.equal(nextOrdered([], ROT), "python");
  assert.equal(nextOrdered([daily("c")], ROT), "rust");
  assert.equal(nextOrdered([daily("go")], ROT), "python", "wraps around");
  assert.equal(pickDailyLang([daily("rust")], ROT, "ordered"), "go");
});
