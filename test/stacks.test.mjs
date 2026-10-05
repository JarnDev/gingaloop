import assert from "node:assert/strict";
import { test } from "node:test";
import { unlockedAreas } from "../src/coverage.mjs";
import { findProfile } from "../src/profiles.mjs";
import { hasEcosystem, pickStack, profileForStack, stackMode } from "../src/stacks.mjs";

const python = findProfile(null, "python");
const c = findProfile(null, "c");

test("python has an ecosystem stack with pinned libraries; c (for now) doesn't", () => {
  assert.ok(hasEcosystem(python));
  for (const lib of python.stacks.ecosystem.libraries) assert.match(lib, /^[\w-]+==\d+\.\d+\.\d+$/, "versions are pinned");
  assert.ok(!hasEcosystem(c));
});

test("profileForStack swaps image, test command, conventions, areas and example", () => {
  const basics = profileForStack(python, "basics");
  const eco = profileForStack(python, "ecosystem");
  assert.equal(basics.image.pull, "python:3.12-slim");
  assert.notEqual(imageOf(eco), imageOf(basics));
  assert.match(eco.testCommand, /pytest/);
  assert.match(eco.conventions, /ECOSYSTEM STACK/);
  assert.ok(eco.exampleDir.endsWith("python.ecosystem"));
  assert.ok(eco.areas.some((a) => a.id === "groupby-aggregation" && a.stack === "ecosystem"));
  assert.ok(!basics.areas.some((a) => a.stack === "ecosystem"));
  assert.throws(() => profileForStack(c, "ecosystem"), /no ecosystem stack/);
  assert.throws(() => profileForStack(python, "deluxe"), /Unknown stack/);
});

const imageOf = (p) => p.image.pull ?? p.image.tag;

test("areas: ecosystem challenges target ecosystem areas; basics never sees them", () => {
  const eco = unlockedAreas(profileForStack(python, "ecosystem"), 1).map((a) => a.id);
  assert.ok(eco.includes("groupby-aggregation") && !eco.includes("hashing"));
  assert.ok(!eco.includes("time-series-pandas"), "minLevel still applies");
  const basics = unlockedAreas(profileForStack(python, "basics"), 9).map((a) => a.id);
  assert.ok(!basics.includes("groupby-aggregation") && basics.includes("hashing"));
});

test("pickStack: basics is absolute, ecosystem always, mixed follows the share", () => {
  assert.equal(pickStack(python, "basics", { share: 1 }), "basics");
  assert.equal(pickStack(c, "ecosystem"), "basics", "no ecosystem stack → basics");
  assert.equal(pickStack(python, "ecosystem"), "ecosystem");
  assert.equal(pickStack(python, "mixed", { share: 0.3, rand: () => 0.29 }), "ecosystem");
  assert.equal(pickStack(python, "mixed", { share: 0.3, rand: () => 0.3 }), "basics");
});

test("stack mode defaults to basics and rejects unknown modes", () => {
  assert.equal(stackMode({ stack: {} }, "python"), "basics");
  assert.equal(stackMode({}, "python"), "basics");
  assert.equal(stackMode({ stack: { python: "mixed" } }, "python"), "mixed");
  assert.throws(() => stackMode({ stack: { python: "max" } }, "python"), /must be one of/);
});
