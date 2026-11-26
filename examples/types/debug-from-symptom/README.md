# The log summary that loses half the errors

## Problem

`starter/solution.mjs` has `summarizeLog(lines)`. The on-call dashboard uses it to count the log
lines of each level.

- A line is `LEVEL message`: an uppercase level (`ERROR`, `WARN`, `AUDIT`…), one space, and a
  message that is not empty.
- The function skips each line that does not have this format.
- It returns an object `{ LEVEL: count }`.
- The same input always gives the same result, also when you call the function again.

The code has a bug. Find the cause and fix it. All of the contract must hold, not only the case
below.

## Symptom

During an incident, the disk became full. The service logged four errors in sequence, but the
dashboard showed only two. A direct call with those four lines prints:

```
{"ERROR":2}
```

## Examples

```js
summarizeLog(["ERROR disk full", "WARN slow", "ERROR retry failed"])  // { ERROR: 2, WARN: 1 }
summarizeLog(["AUDIT login ok", "garbage", "ERROR"])                  // { AUDIT: 1 }
```

## Constraints

- Use only the Node.js standard library.
- Fix the cause. A special case for the symptom does not pass the tests.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
