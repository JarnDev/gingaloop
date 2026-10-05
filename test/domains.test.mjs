import assert from "node:assert/strict";
import { test } from "node:test";
import { GENERAL, allDomains, configuredDomains, domainBrief, ecosystemShare, pickDomain } from "../src/domains.mjs";

test("the catalog has 40 unique domains, general included, each complete", () => {
  const ds = allDomains();
  assert.equal(ds.length, 40);
  assert.equal(new Set(ds.map((d) => d.id)).size, 40);
  assert.ok(ds.some((d) => d.id === "quant" && d.topics.length >= 10));
  for (const d of ds) {
    assert.match(d.id, /^[a-z0-9-]+$/);
    assert.ok(d.name && d.group && d.focus, d.id);
    assert.ok(d.ecosystemShare >= 0 && d.ecosystemShare <= 1, d.id);
  }
});

test("config defaults to general and rejects unknown domains", () => {
  assert.deepEqual(configuredDomains({}), ["general"]);
  assert.deepEqual(configuredDomains({ domains: [] }), ["general"]);
  assert.deepEqual(configuredDomains({ domains: ["Quant", "fintech", "quant"] }), ["quant", "fintech"]);
  assert.throws(() => configuredDomains({ domains: ["cooking"] }), /Unknown domain "cooking"/);
});

test("only general configured: always general", () => {
  assert.equal(pickDomain([], ["general"], () => 0.99), GENERAL);
});

test("general shows up ~1 in 4; the rest is a shuffle bag over the chosen domains", () => {
  assert.equal(pickDomain([], ["quant", "fintech"], () => 0.1), GENERAL);
  const gen = (domain) => ({ type: "generated", domain });
  const events = [gen("quant"), gen("general")];
  assert.equal(pickDomain(events, ["quant", "fintech", "general"], () => 0.9), "fintech", "quant was already drawn this cycle");
  assert.equal(pickDomain([...events, gen("fintech")], ["quant", "fintech"], () => 0.5), "fintech", "bag refills after a full cycle");
});

test("ecosystem share and brief come from the catalog", () => {
  assert.equal(ecosystemShare("quant"), 0.5);
  assert.equal(ecosystemShare("embedded"), 0.1);
  assert.equal(ecosystemShare("unknown"), 0.3);
  assert.match(domainBrief("quant"), /Quant finance: .*drawdown/);
  assert.match(domainBrief("general"), /no industry framing/);
});

test("the domain feeds the stack choice in mixed mode", async () => {
  const { pickStack } = await import("../src/stacks.mjs");
  const { findProfile } = await import("../src/profiles.mjs");
  const python = findProfile(null, "python");
  const r = () => 0.4; // between embedded's 0.1 and quant's 0.5
  assert.equal(pickStack(python, "mixed", { share: ecosystemShare("quant"), rand: r }), "ecosystem");
  assert.equal(pickStack(python, "mixed", { share: ecosystemShare("embedded"), rand: r }), "basics");
  assert.equal(pickStack(python, "basics", { share: ecosystemShare("quant"), rand: () => 0 }), "basics", "basics is absolute");
});
