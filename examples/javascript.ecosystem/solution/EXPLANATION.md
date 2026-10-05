# Validate a signup form with zod: explanation

## Approach

Describe the accepted shape **once**, as a schema, and let zod both check and normalize:

- `z.string().trim().toLowerCase().email()`: string checks and transforms run in order, so the email
  is cleaned up before it's validated, and `data.email` comes out normalized.
- `z.number().int().min(13).optional()`: `optional()` allows the key to be missing, while `int()`
  rejects `13.5`.
- `z.boolean().default(false)` fills in the missing flag.
- `.strict()` turns unknown keys into an issue instead of silently dropping them.

`safeParse` never throws; on failure, each issue either has a `path` (the field) or, for unknown
keys, a `keys` list. Collect the first path element, de-duplicate with a `Set`, sort.

Trace: `{ email: "nope", password: "short", age: 1.5, zeta: 1 }` produces issues at `email` (not an
email), `password` (too short), `age` (not an int), `age` (below 13) and an unrecognized-keys issue
with `keys: ["zeta"]`, which becomes `["age", "email", "password", "zeta"]`.

## Complexity

O(size of the input) per call. The schema is built once at module load, not per request.

## Alternatives

- Hand-written `typeof` checks work for three fields, but they drift from the documentation, forget
  normalization and rarely reject unknown keys.
- `z.object(...).passthrough()` keeps unknown keys in `data`: useful for proxies, wrong for a signup
  where `admin: true` must never get through.
- `parse` + try/catch works, but `safeParse` makes the failure path an ordinary value.

## Common bugs

- **Checking before normalizing** (`bugs/no-normalize`): `z.string().email()` alone rejects
  `"  Ana@Example.COM "` or stores the unnormalized address. Caught by "normalizes the email".
- **Forgetting `.int()`** (`bugs/age-allows-floats`): `13.5` slips through. Caught by "age must be a
  whole number".
- **Relying on the default object mode** (`bugs/strips-unknown-keys`): zod's default *strips*
  unknown keys, so the call succeeds and `admin: true` silently disappears instead of being reported.
  Caught by "unknown fields are rejected".

## Idioms

- Schemas are values: build them once at module level and reuse them.
- `safeParse` + `result.error.issues` for structured error reporting.
- Test with `toEqual` on the whole result, so extra or missing keys fail the test too.

## Level up

1. Return per-field messages (`{ field, message }[]`) with custom texts via `z.string({ message })`.
2. Add `confirmPassword` and a `.refine()` that reports the mismatch on the right field.
