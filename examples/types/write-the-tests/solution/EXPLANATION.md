# Write the tests for a duration parser: explanation

## Approach

Turn the contract into a checklist, and give each rule its own test, so that a failing test tells
you exactly which rule broke:

| Rule | Test | Bug it catches |
|---|---|---|
| each unit's weight | `test_each_unit_has_its_own_weight` (`1h`, `1m`, `1s` alone) | `minutes-as-seconds` |
| order h → m → s | `test_units_out_of_order_are_rejected` | `accepts-any-order` |
| each unit at most once | `test_repeated_unit_is_rejected` | `split-allows-repeats` |
| empty text is invalid | `test_empty_text_is_rejected` | `regex-allows-empty` |
| exact error message | `test_exact_error_message` checks `str(exc)` | `wrong-message` |

The reference keeps each rule in its own file (`test_item<N>_….py`, numbered like "What to test"),
and only the message file checks the message. One test that checks everything at once would still
catch every bug, but it can't tell you which rule a failure is about.

The starter's two example tests (`"45s"`, and an unknown unit checked only for `ValueError`) pass
on every buggy version on purpose: they show the harness and leave every catch to you.

## Complexity

Each test is O(1). The whole suite runs in milliseconds, so it's cheap to be thorough.

## Alternatives

- `subTest` loops over a table of `(text, expected)` pairs. They're compact, but name the table
  entries well, or a failure is hard to read.
- Property-based testing (Hypothesis) generates inputs automatically: e.g. "formatting a random
  number of seconds and parsing it back gives the same number". It's not in the standard library,
  but it's great at finding the cases you didn't think of.

## Common bugs

The hidden versions are mistakes people make when *writing* such a parser. A good suite catches all
of them:

- **Checking order with `==` instead of `<=`** (`bugs/accepts-any-order`).
- **A wrong weight** (`bugs/minutes-as-seconds`), invisible to any test without minutes in it,
  such as the starter's `"45s"`.
- **A regex with all-optional groups** (`bugs/regex-allows-empty`): `""` matches and returns 0.
- **Order checked between neighbors with `>`** (`bugs/split-allows-repeats`): `1h2h` passes.
- **A message that drifts** (`bugs/wrong-message`): still a `ValueError`, but without the quotes
  around the text. Only an exact `assertEqual` on `str(exception)` notices; `assertRaises` alone
  does not.

## Idioms

- One behavior per test; name tests after the rule (`test_repeated_unit_is_rejected`).
- A small helper (`assert_invalid`) for the repeated error-contract assertions.
- Assert the message, not just the type: `assertRaises(...) as ctx` then `str(ctx.exception)`.

## Level up

1. Add a round-trip property test: `parse_duration(format_duration(n)) == n` for many `n`.
2. Write the tests first for a new feature (`"1.5h"`), then extend the subject until they pass.
