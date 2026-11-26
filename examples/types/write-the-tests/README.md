# Write the tests for a duration parser

## Problem

`subject/subject.py` contains a working `parse_duration(text: str) -> int`. It reads timeouts from
config files. Your task is the **test suite**. Write it in `starter/`, one file for each item of
"What to test" below. The suite must pass on this correct code and **fail on buggy versions** of it.

The grader runs your tests against some hidden buggy versions. Each buggy version must make a test
fail. That test must be in the file of the item that the version breaks.

The contract:

- The text is a sequence of `<integer><unit>` parts. The units are `h` (hours), `m` (minutes) and
  `s` (seconds).
- The units occur in this order: `h`, then `m`, then `s`. Each unit occurs at most one time.
- The text has no spaces. Valid texts: `"1h30m"`, `"45s"`, `"2h5s"`.
- The function returns the total number of seconds: `"1h30m"` → 5400.
- All other texts raise `ValueError(f"invalid duration: {text!r}")`. This includes an empty text,
  an unknown unit, units out of order, a repeated unit, a missing number, a space and a negative
  number.

## Subject

Read `subject/subject.py`. Your tests import it with `from subject import parse_duration`.

## What to test

1. Each unit has the correct weight, alone and in combination (`"1h30m"` → 5400).
2. The function rejects units out of order.
3. The function rejects a repeated unit.
4. The function rejects an empty text.
5. The error has the exact type and message, `ValueError("invalid duration: '<text>'")`.

Also test unknown units, missing numbers, spaces and signs. Think in input classes. Test each rule
on its own.

## Examples

`starter/` already has two example tests, in `test_item1_weights.py` and
`test_other_invalid.py`. They show the harness:

```python
def test_seconds_alone(self):
    self.assertEqual(parse_duration("45s"), 45)

def test_unknown_unit_is_rejected(self):
    with self.assertRaises(ValueError):
        parse_duration("5d")
```

They pass on all versions, correct and buggy. Only the tests that you add can catch the bugs.

## Constraints

- Use `unittest` (standard library).
- Write one file for each "What to test" item, named `starter/test_item<N>_….py`. Keep the
  `item<N>` in the name.
- A test in another item's file can also catch a buggy version. That counts as caught, but by
  luck: the solve is not clean, and the topic comes back as a review.
- Put tests for all other behavior in `test_other_invalid.py`.
- Your tests must pass on `subject/` as it is.

## How to run

- `ginga test` runs your tests against the correct subject and the hidden buggy versions. It
  shows how many buggy versions your tests catch.
- `ginga hint` reveals one hint at a time.
- `ginga done` records the solve when your tests catch all of them.
