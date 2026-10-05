# The log summary that loses half the errors: explanation

## Approach

**Reading the symptom.** Exactly every other line is lost, and each lost line is valid on its own,
so something carries state from one iteration to the next. The only thing shared across iterations
(and calls) is the module-level `LINE` regex.

**The mechanism.** With the `g` (or `y`) flag, `RegExp.prototype.exec` and `test` start at
`regex.lastIndex` and update it:

1. Line 1 matches, so `lastIndex` becomes 15, the end of `"ERROR disk full"`.
2. Line 2 is searched from index 15. The pattern is anchored with `^`, so it fails, `exec` returns
   `null` and resets `lastIndex` to 0.
3. Line 3 matches again, line 4 fails, and so on.

The result is `{"ERROR":2}` for four lines. **The fix** is to remove the `g` flag (one match per line
is all that's needed), which makes the regex stateless.

## Complexity

O(total characters) for the regex matching, as before. The fix doesn't change the complexity.

## Alternatives

- Keep `g` and set `LINE.lastIndex = 0` before **every** `exec`: it works, but it's fragile. Any other
  caller that forgets the reset brings the bug back.
- Use `line.match(LINE)` with a non-global regex: the same fix, shorter.
- Build the regex inside the function: correct, but it's recompiled on every call (cheap here).

## Common bugs

These are the wrong fixes a debugger reaches for:

- **Resetting once per call** (`bugs/reset-once`): consecutive lines in the same call still alternate.
  Caught by "calling it twice gives the same result" (and "consecutive lines are all counted").
- **A hard-coded list of levels** (`bugs/known-levels-only`): the symptom is gone, but `AUDIT` is no
  longer counted. Caught by "any uppercase level is counted".
- **Splitting on the first space** (`bugs/split-first-word`): the symptom is gone, but `"ERROR"`
  without a message now counts. Caught by "lines without a message are skipped".

## Idioms

- Avoid `g`/`y` on regexes stored in shared constants unless you need `lastIndex` on purpose
  (`matchAll`, tokenizers).
- When a bug alternates or depends on call order, look for state outside the function first.

## Level up

1. Return the messages per level too, using `String.prototype.matchAll` on the whole log text (where
   `g` is required).
2. Add a timestamp prefix (`2026-10-05T12:00:00Z ERROR …`) and count per minute.
