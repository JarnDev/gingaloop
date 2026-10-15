The user receives a CORRECT implementation and writes the test suite. Their suite is graded like
mutation testing: it must PASS on the correct code and FAIL on every hidden buggy version.

Layout (differs from the generic one):
```
subject/            # the correct implementation, VISIBLE to the user (what they test)
starter/            # the user's test file(s): imports + 1 trivial example test + TODOs; this suite
                    # must NOT catch all bugs yet (it fails the grading)
solution/           # the reference test suite (same file names as starter/) + EXPLANATION.md
bugs/<name>/        # buggy copies of subject/ (same file names), at least one per "What to test"
                    # item, each a realistic bug a good test suite must catch; at least one kind
                    # "alternative" (a different approach)
tests/              # the harness: runs the test suite in ../$TESTS against the implementation in
                    # ../$IMPL (IMPL is "subject" or "bugs/<name>")
```
- `test.command` runs the suite from `../$TESTS` with the implementation from `../$IMPL` importable
  under its normal name. Python: `PYTHONPATH=../$IMPL python3 -m unittest discover -s ../$TESTS -p "test_*.py" -v`
  (ecosystem: `PYTHONPATH=../$IMPL python3 -m pytest -q -p no:cacheprovider -rf ../$TESTS`). Other
  languages: an equivalent harness in tests/ (a small runner script or Makefile) reading TESTS and IMPL.
- The user's tests import the subject by its module name (e.g. `from subject import parse`), so the
  same tests run against every implementation unchanged.
- `bugs[].expect` is the name of the REFERENCE test that catches that bug.
- `bugs[].breaks` is the number (or list of numbers) of the "What to test" item(s) the bug breaks.
  EVERY item needs at least one bug that breaks it, ideally that item alone: a promise no bug breaks
  is one the user's suite can skip and still pass, so the grading would not check it. This includes
  the easy-to-forget ones: the exact error type and message, empty input, falsy values, returning a
  new object vs the same reference. The validator rejects an item without a bug; when a promise is
  not worth a bug, leave it out of "What to test".
- README: `## Problem` describes the subject's contract precisely (what the tests should pin down);
  `## Subject` names the files in subject/; `## What to test` is a numbered list of the behaviors
  to pin down, 3–7 items, one behavior each (not the bugs!);
  `## Examples` shows a couple of example test cases; `## Constraints` (framework, no network).
- The validator grades the reference suite (passes on subject, catches every bug on the expected
  test) and checks the starter suite does not pass the grading.
- EXPLANATION.md: why each reference test exists, which bug it catches, and how to think about test
  design (equivalence classes, boundaries, error contracts).
