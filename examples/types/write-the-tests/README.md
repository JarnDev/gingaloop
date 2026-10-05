# Write the tests for a duration parser

## Problem

`subject/subject.py` contains a working `parse_duration(text: str) -> int`, used to read timeouts
from config files. Your job is the **test suite**: write it in `starter/test_subject.py` so that it
passes on this correct code and **fails on buggy versions** of it. The grader runs your tests against
several hidden buggy implementations, and each one must make at least one of your tests fail.

The contract to pin down:

- Text is made of `<integer><unit>` parts with units `h`, `m`, `s` (hours, minutes, seconds), in
  that order (`h` before `m` before `s`), each unit at most once, no spaces: `"1h30m"`, `"45s"`,
  `"2h5s"`.
- Returns the total in seconds: `"1h30m"` → 5400.
- Anything else raises `ValueError(f"invalid duration: {text!r}")`: empty text, unknown units,
  units out of order or repeated, missing numbers, spaces, negative numbers.

## Subject

`subject/subject.py` (read it!). Your tests import it as `from subject import parse_duration`.

## What to test

The happy path for each unit and their combinations, the weight of each unit, and every way the
input can be invalid listed above, including the exact error message. Think in input classes, and
test each rule on its own.

## Examples

```python
def test_hours_and_minutes(self):
    self.assertEqual(parse_duration("1h30m"), 5400)

def test_unknown_unit_is_rejected(self):
    with self.assertRaisesRegex(ValueError, r"^invalid duration: '5d'$"):
        parse_duration("5d")
```

## Constraints

- `unittest` (standard library); one test file, `starter/test_subject.py`.
- Your tests must pass on `subject/` as it is.

## How to run

- `ginga test` runs your tests against the correct subject and the hidden buggy versions, and reports
  how many it catches.
- `ginga hint` reveals one hint at a time.
- `ginga done` when your tests catch all of them.
