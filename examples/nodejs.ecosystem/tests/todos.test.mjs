import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// See the profile conventions: Vite only resolves template-string imports one level deep.
const target = new URL(`../${process.env.TARGET ?? "starter"}/solution.mjs`, import.meta.url).href;
const { buildApp } = await import(/* @vite-ignore */ target);

const call = async (app, method, url, payload) => {
  const res = await app.inject({ method, url, payload });
  return { status: res.statusCode, body: res.body ? res.json() : null };
};

describe("todo API", () => {
  it("create returns 201 with the new todo (title trimmed)", async () => {
    const app = buildApp();
    expect(await call(app, "POST", "/todos", { title: "  buy milk " })).toEqual({ status: 201, body: { id: 1, title: "buy milk", done: false } });
    expect((await call(app, "POST", "/todos", { title: "b" })).body.id).toBe(2);
  });

  it("each app instance has its own store (ids start at 1)", async () => {
    await call(buildApp(), "POST", "/todos", { title: "x" });
    expect(await call(buildApp(), "POST", "/todos", { title: "y" })).toEqual({ status: 201, body: { id: 1, title: "y", done: false } });
  });

  it("rejects blank or non-string titles with 400", async () => {
    const app = buildApp();
    for (const payload of [{ title: "   " }, { title: 42 }, {}, { title: "x".repeat(101) }]) {
      expect(await call(app, "POST", "/todos", payload), JSON.stringify(payload)).toEqual({ status: 400, body: { error: "invalid body" } });
    }
    expect((await call(app, "POST", "/todos", { title: ` ${"x".repeat(100)} ` })).status).toBe(201);
  });

  it("GET returns the todo or a 404 with an error body", async () => {
    const app = buildApp();
    await call(app, "POST", "/todos", { title: "a" });
    expect(await call(app, "GET", "/todos/1")).toEqual({ status: 200, body: { id: 1, title: "a", done: false } });
    for (const id of ["2", "0", "abc"]) expect(await call(app, "GET", `/todos/${id}`)).toEqual({ status: 404, body: { error: "not found" } });
  });

  it("PATCH updates done, validates the body, 404s unknown ids", async () => {
    const app = buildApp();
    await call(app, "POST", "/todos", { title: "a" });
    expect(await call(app, "PATCH", "/todos/1", { done: true })).toEqual({ status: 200, body: { id: 1, title: "a", done: true } });
    expect(await call(app, "PATCH", "/todos/1", { done: "yes" })).toEqual({ status: 400, body: { error: "invalid body" } });
    expect(await call(app, "PATCH", "/todos/7", { done: true })).toEqual({ status: 404, body: { error: "not found" } });
  });

  it("golden request scripts", async () => {
    const scripts = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
    for (const { steps } of scripts) {
      const app = buildApp();
      for (const { method, url, payload, expected } of steps) {
        expect(await call(app, method, url, payload), `${method} ${url} ${JSON.stringify(payload)}`).toEqual(expected);
      }
    }
  });
});
