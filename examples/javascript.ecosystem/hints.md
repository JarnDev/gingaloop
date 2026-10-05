## Hint 1
Describe the whole object as one schema and let zod do the checking; `safeParse` gives you either the
data or a list of issues, without throwing.

## Hint 2
String schemas can normalize (`.trim()`, `.toLowerCase()`) before later checks such as `.email()`.
`z.object({...})` silently drops unknown keys by default: something has to make it complain instead.

## Hint 3
`z.object({ ... }).strict()`, then map `result.error.issues`: an issue with a path names a field
(`path[0]`), and an "unrecognized keys" issue carries the unknown names in `keys`.
