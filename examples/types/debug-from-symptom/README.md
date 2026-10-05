# The log summary that loses half the errors

## Problem

`starter/solution.mjs` has `summarizeLog(lines)`, used by the on-call dashboard to count log lines
per level. A line is `LEVEL message`: an uppercase level (`ERROR`, `WARN`, `AUDIT`…), one space, and
a non-empty message. Malformed lines are skipped. It returns an object `{ LEVEL: count }`, and calling
it again must give the same result for the same input.

It's buggy. Find the cause and fix it so the whole contract holds, not just the case below.

## Symptom

During an incident the disk filled up and the service logged four errors in a row, but the dashboard
showed half of them. Calling it directly with those four lines prints:

```
{"ERROR":2}
```

## Examples

```js
summarizeLog(["ERROR disk full", "WARN slow", "ERROR retry failed"])  // { ERROR: 2, WARN: 1 }
summarizeLog(["AUDIT login ok", "garbage", "ERROR"])                  // { AUDIT: 1 }
```

## Constraints

- Node.js standard library only. Fix the cause; special-casing the symptom won't pass the tests.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
