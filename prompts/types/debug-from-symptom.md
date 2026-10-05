Like fix-the-bug, but the user only gets a SYMPTOM, never the location of the bug.

- starter/ contains a plausible implementation with 1–2 real bugs (the kind found in production).
- README `## Symptom`: what a user/operator observed, as a fenced block with the REAL output of
  running the reproduction (a failing scenario, a wrong result, a log line or a crash message), plus
  one sentence of context. Do NOT name the function, file, line or cause anywhere in the README or
  hints 1–2 (hint 3 may narrow it to a function).
- challenge.json: `"symptom": { "command": "<shell command run in tests/ with TARGET=starter>" }`. The
  validator runs it on the starter and requires every non-empty line of the README's symptom block to
  appear in its output, so copy the output exactly.
- The tests check the full contract (not only the symptom), so a patch that hides the symptom but
  leaves the bug fails.
- bugs/<name>/: 3–5 WRONG FIXES a debugger would plausibly make (special-casing the symptom input,
  catching and ignoring the error, fixing one of two bugs, fixing the caller instead of the cause);
  at least one kind "alternative". Each must fail on the right test.
- README sections: `## Problem` (what the code is supposed to do), `## Symptom`, `## Examples`
  (correct expected behavior), `## Constraints`.
