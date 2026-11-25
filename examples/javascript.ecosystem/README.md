# Validate a signup form with zod

## Problem

The signup endpoint receives JSON that it cannot trust. Write `validateSignup(input)` in
`starter/solution.mjs` with [zod](https://zod.dev). This challenge has zod installed. The function
returns `{ ok: true, data }` or `{ ok: false, fields }`.

- `email`: a string. The function removes the spaces at its start and end and makes it lowercase.
  It does this **before** it checks the email address.
- `password`: a string of at least 8 characters, with at least one digit.
- `age`: optional. If it is present, it is a **whole** number, 13 or more.
- `newsletter`: an optional boolean. If it is missing, its value is `false`.
- **Each other field is an error.**

`data` is the normalized object. `fields` lists the names of the top-level fields that are invalid
or unknown. The list is sorted, and each name occurs one time. If the input is not an object,
`fields` is `["(input)"]`.

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

- Use zod for the validation. Do not write type checks yourself.
- The available libraries are zod 3.23 and vitest 2.1 (for the tests).

## How to run

- `ginga test` runs the tests (vitest) against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
