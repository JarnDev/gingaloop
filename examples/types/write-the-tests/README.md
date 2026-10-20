# Write the tests for a duration parser

## Problem

`subject/subject.py` contains a working `parse_duration(text: str) -> int`, used to read timeouts
from config files. Your job is the **test suite**: write it in `starter/`, one file per item of
"What to test" below, so that it passes on this correct code and **fails on buggy versions** of it.
The grader runs your tests against several hidden buggy implementations: each one must make a test
fail, and it must be a test in the file of the item that version breaks.

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

1. The weight of each unit, alone and combined (`"1h30m"` → 5400).
2. Units out of order are rejected.
3. A repeated unit is rejected.
4. Empty text is rejected.
5. The exact error type and message, `ValueError("invalid duration: '<text>'")`.

Also try unknown units, missing numbers, spaces and signs. Think in input classes, and test each
rule on its own.

## Examples

The two example tests already in `starter/` (`test_item1_weights.py` and `test_other_invalid.py`),
to show the harness:

```python
def test_seconds_alone(self):
    self.assertEqual(parse_duration("45s"), 45)

def test_unknown_unit_is_rejected(self):
    with self.assertRaises(ValueError):
        parse_duration("5d")
```

They pass on every version, buggy or not: catching the bugs is up to the tests you add.

## Constraints

- `unittest` (standard library); one file per "What to test" item, `starter/test_item<N>_….py`
  (keep the `item<N>` in the name). A version caught only by another item's file counts as caught,
  but by luck: the solve isn't clean and the topic comes back as a review. Tests for anything else
  go in `test_other_invalid.py`.
- Your tests must pass on `subject/` as it is.

## How to run

- `ginga test` runs your tests against the correct subject and the hidden buggy versions, and reports
  how many it catches.
- `ginga hint` reveals one hint at a time.
- `ginga done` when your tests catch all of them.
