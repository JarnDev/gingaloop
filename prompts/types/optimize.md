The user gets CORRECT but too-slow code and must make it fast enough.

- starter/: a correct, readable but slow implementation (wrong complexity class, e.g. O(n²) nested
  scans, repeated work, quadratic string building, linear lookups in a loop).
- solution/: the same behavior in a better complexity class.
- tests/: correctness tests, plus budget tests that run only when GINGA_PERF is not "0". A budget
  test times the call on a LARGE input and fails with a message containing the word "budget" when
  it exceeds `budget.seconds`. Choose input sizes so the two complexity classes differ by at least
  100× (for example n = 200 000: O(n²) ≈ 4·10^10 steps vs O(n log n) ≈ 3.5·10^6). The machine
  running the tests may be loaded, so the reference must finish in under 10% of the budget and the
  starter must need well over 10× the budget. Enforce the budget inside the test (measure, or abort
  after budget × 3 with a clear "over budget" failure) so a slow starter fails quickly instead of
  hitting the sandbox timeout.
- challenge.json: `"budget": { "seconds": <number>, "expect": "<name of the budget test>" }` and a
  `test.timeoutSeconds` comfortably above the budget.
- The validator checks: with GINGA_PERF=0 the starter PASSES (it's correct); normally the starter
  fails on the budget test; the reference passes in under half the timeout.
- bugs/<name>/: 3–5 faster-but-WRONG versions (an optimization that breaks an edge case: losing
  duplicates, wrong boundary after switching to binary search, cache keyed incorrectly) and/or
  "almost optimized" versions that are still too slow; at least one kind "alternative".
- README sections: `## Problem` (the behavior, unchanged), `## Budget` (the input size and the time
  budget, measured inside the tests), `## Examples`, `## Constraints`.
