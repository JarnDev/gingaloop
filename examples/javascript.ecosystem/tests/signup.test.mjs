import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// vitest (Vite) rewrites dynamic imports with template strings, and only resolves variables one
// level deep (bugs/<name>/ is two): pass a full URL and ask Vite to leave it alone.
const target = new URL(`../${process.env.TARGET ?? "starter"}/solution.mjs`, import.meta.url).href;
const { validateSignup } = await import(/* @vite-ignore */ target);
const ok = { email: "ana@example.com", password: "hunter22" };

describe("validateSignup", () => {
  it("accepts a valid signup and defaults newsletter to false", () => {
    expect(validateSignup(ok)).toEqual({ ok: true, data: { ...ok, newsletter: false } });
  });

  it("normalizes the email (trim + lowercase) before checking it", () => {
    const r = validateSignup({ ...ok, email: "  Ana@Example.COM " });
    expect(r).toEqual({ ok: true, data: { ...ok, newsletter: false } });
  });

  it("password needs 8+ characters and a digit", () => {
    expect(validateSignup({ ...ok, password: "short1" })).toEqual({ ok: false, fields: ["password"] });
    expect(validateSignup({ ...ok, password: "no-digits-here" })).toEqual({ ok: false, fields: ["password"] });
  });

  it("age must be a whole number from 13 up", () => {
    expect(validateSignup({ ...ok, age: 13 }).ok).toBe(true);
    expect(validateSignup({ ...ok, age: 12 })).toEqual({ ok: false, fields: ["age"] });
    expect(validateSignup({ ...ok, age: 13.5 })).toEqual({ ok: false, fields: ["age"] });
  });

  it("unknown fields are rejected and named", () => {
    expect(validateSignup({ ...ok, admin: true, role: "x" })).toEqual({ ok: false, fields: ["admin", "role"] });
  });

  it("fields are sorted and de-duplicated across rules", () => {
    expect(validateSignup({ email: "nope", password: "short", age: 1.5, zeta: 1 })).toEqual({
      ok: false, fields: ["age", "email", "password", "zeta"],
    });
  });

  it("non-object input is reported as (input)", () => {
    for (const bad of ["nope", 42, null, [ok]]) expect(validateSignup(bad)).toEqual({ ok: false, fields: ["(input)"] });
  });

  it("golden cases", () => {
    const cases = JSON.parse(readFileSync(new URL("./cases.json", import.meta.url), "utf8"));
    for (const { input, expected } of cases) expect(validateSignup(input), JSON.stringify(input)).toEqual(expected);
  });
});
