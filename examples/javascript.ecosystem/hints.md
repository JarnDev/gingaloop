## Hint 1
Write one schema for the whole object, and let zod do the checks. `safeParse` does not throw. It
gives you the data or a list of issues.

## Hint 2
A string schema can normalize the value (`.trim()`, `.toLowerCase()`) before later checks such as
`.email()`. By default, `z.object({...})` removes unknown keys and reports no error. You must change
this, so that unknown keys give an error.

## Hint 3
Use `z.object({ ... }).strict()`. Then map `result.error.issues`. An issue with a path names a field
(`path[0]`). An "unrecognized keys" issue has the unknown names in `keys`.
