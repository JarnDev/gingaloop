import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// See the profile conventions: Vite only resolves template-string imports one level deep.
const target = new URL(`../${process.env.TARGET ?? "starter"}/solution.ts`, import.meta.url).href;
const { parseEvents } = await import(/* @vite-ignore */ target);

describe("parseEvents", () => {
  it("keeps valid events in order and drops extra fields", () => {
    expect(parseEvents(['{"type":"click","x":10,"y":4}', '{"type":"purchase","sku":"A-1","cents":1999,"debug":true}'])).toEqual({
      events: [{ type: "click", x: 10, y: 4 }, { type: "purchase", sku: "A-1", cents: 1999 }],
      rejected: [],
    });
  });

  it("invalid JSON lines are rejected, not thrown", () => {
    expect(parseEvents(["not json", '{"type":"click","x":1,"y":2}', "{"])).toEqual({
      events: [{ type: "click", x: 1, y: 2 }],
      rejected: [0, 2],
    });
  });

  it("cents must be a positive whole number", () => {
    const r = parseEvents(['{"type":"purchase","sku":"A","cents":19.99}', '{"type":"purchase","sku":"A","cents":0}']);
    expect(r).toEqual({ events: [], rejected: [0, 1] });
  });

  it("sku must be a non-empty string", () => {
    const r = parseEvents(['{"type":"purchase","sku":"","cents":5}', '{"type":"purchase","sku":7,"cents":5}']);
    expect(r).toEqual({ events: [], rejected: [0, 1] });
  });

  it("unknown types and missing fields are rejected", () => {
    const r = parseEvents(['{"type":"scroll","dy":3}', '{"type":"click","x":1}', '{"x":1,"y":2}', "null", "[]"]);
    expect(r).toEqual({ events: [], rejected: [0, 1, 2, 3, 4] });
  });

  it("empty input gives nothing", () => {
    expect(parseEvents([])).toEqual({ events: [], rejected: [] });
  });

  it("golden cases", () => {
    const cases: { lines: string[]; expected: unknown }[] = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
    for (const { lines, expected } of cases) expect(parseEvents(lines), JSON.stringify(lines)).toEqual(expected);
  });
});
