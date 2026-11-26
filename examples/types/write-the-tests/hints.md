## Hint 1
A test catches a hidden bug only if its input makes the buggy result different from the contract.
Read the contract one line at a time. Each line needs at least one test.

## Hint 2
Test each input class on its own. Test each unit alone, so that a wrong weight shows. Then test
combinations. Then test each kind of invalid text: empty, unknown unit, out of order, repeated,
with a space, with a missing number. Check the error message, not only the exception type.

## Hint 3
`parse_duration("30m1h")`, `parse_duration("1h2h")` and `parse_duration("")` must raise.
`parse_duration("1m") == 60` and `parse_duration("1s") == 1` check the weights.
