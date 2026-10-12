import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { allAreas, coverageCounts, genericAreas, pickArea, unlockedAreas } from "../src/coverage.mjs";

const profile = {
  id: "c",
  areas: [
    { id: "pointers-arrays", name: "Pointers", minLevel: 1 },
    { id: "allocators", name: "Allocators", minLevel: 6 },
    { id: "strings", name: "C-specific strings", minLevel: 1 },
  ],
};
const gen = (area, lang = "c") => ({ type: "generated", lang, area });

test("profile areas come first and override generic ones with the same id", () => {
  const areas = allAreas(profile);
  assert.equal(areas[0].id, "pointers-arrays");
  const strings = areas.filter((a) => a.id === "strings");
  assert.equal(strings.length, 1);
  assert.equal(strings[0].name, "C-specific strings");
  assert.ok(areas.some((a) => a.id === "graphs" && !a.specific));
});

test("only areas unlocked at the level are offered", () => {
  const l1 = unlockedAreas(profile, 1).map((a) => a.id);
  assert.ok(l1.includes("pointers-arrays") && l1.includes("hashing"));
  assert.ok(!l1.includes("allocators") && !l1.includes("graphs"));
  assert.ok(unlockedAreas(profile, 6).some((a) => a.id === "allocators"));
});

test("picks the least-covered unlocked area", () => {
  const l1 = unlockedAreas(profile, 1).map((a) => a.id);
  const events = l1.filter((id) => id !== "math-bits").flatMap((id) => [gen(id), gen(id)]);
  events.push(gen("math-bits"), gen("math-bits", "python"), gen("math-bits", "python"));
  assert.equal(pickArea(profile, 1, events).id, "math-bits", "1 vs 2 in every other area; other languages don't count");
});

test("ties are broken by the random source, among the least covered only", () => {
  const events = [gen("pointers-arrays")];
  const ids = unlockedAreas(profile, 1).map((a) => a.id).filter((id) => id !== "pointers-arrays");
  assert.equal(pickArea(profile, 1, events, () => 0).id, ids[0]);
  assert.equal(pickArea(profile, 1, events, (n) => n - 1).id, ids.at(-1));
});

test("coverage counts ignore events without an area", () => {
  const counts = coverageCounts([gen("strings"), { type: "generated", lang: "c" }, gen("strings")], "c");
  assert.deepEqual([...counts], [["strings", 2]]);
});

test("genericAreas keeps only the listed generic areas", () => {
  const sql = { id: "sql", areas: [{ id: "joins", name: "Joins", minLevel: 1 }], genericAreas: ["intervals", "graphs"] };
  const ids = allAreas(sql).map((a) => a.id);
  assert.deepEqual(ids.sort(), ["graphs", "intervals", "joins"]);
  assert.deepEqual(unlockedAreas(sql, 10).map((a) => a.id).sort(), ["graphs", "intervals", "joins"]);
});

test("every level from 1 to 10 introduces at least one generic area", () => {
  const levels = new Set(genericAreas().map((a) => a.minLevel));
  for (let l = 1; l <= 10; l++) assert.ok(levels.has(l), `no generic area at L${l}`);
});

test("built-in profiles: unique area ids, levels 1-10, genericAreas that exist", () => {
  const generic = new Set(genericAreas().map((a) => a.id));
  for (const f of readdirSync(new URL("../profiles/", import.meta.url))) {
    const p = JSON.parse(readFileSync(new URL(`../profiles/${f}`, import.meta.url), "utf8"));
    const own = [...(p.areas ?? []), ...(p.stacks?.ecosystem?.areas ?? [])];
    const ids = own.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, `${f}: duplicate area id`);
    for (const a of own) assert.ok(a.minLevel >= 1 && a.minLevel <= 10, `${f}: ${a.id} minLevel ${a.minLevel}`);
    for (const id of p.genericAreas ?? []) assert.ok(generic.has(id), `${f}: unknown generic area ${id}`);
  }
});
