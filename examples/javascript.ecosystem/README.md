# Validate a signup form with zod

## Problem

The signup endpoint receives untrusted JSON. Implement `validateSignup(input)` in
`starter/solution.mjs` with [zod](https://zod.dev) (available in this challenge). It returns
`{ ok: true, data }` or `{ ok: false, fields }`:

- `email`: a string; surrounding spaces are trimmed and it's lowercased **before** it's checked as an
  email address.
- `password`: a string of at least 8 characters containing at least one digit.
- `age`: optional; when present, a **whole** number from 13 up.
- `newsletter`: optional boolean, `false` when missing.
- **Any other field is an error.**

`data` is the normalized object. `fields` is the sorted, de-duplicated list of the top-level field
names that are invalid or unknown; when the input isn't an object at all, it's `["(input)"]`.

## Examples

```js
validateSignup({ email: "  Ana@Example.COM ", password: "hunter22" })
// { ok: true, data: { email: "ana@example.com", password: "hunter22", newsletter: false } }
validateSignup({ email: "ana@example.com", password: "short", age: 12.5, admin: true })
// { ok: false, fields: ["admin", "age", "password"] }
validateSignup("nope")
// { ok: false, fields: ["(input)"] }
```

## Constraints

- Use zod for the validation; no hand-written type checks.
- Libraries available: zod 3.23, vitest 2.1 (tests).

## How to run

- `ginga test` runs the tests (vitest) against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
