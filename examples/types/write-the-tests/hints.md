## Hint 1
A hidden bug only gets caught if some test feeds the code an input where the buggy behavior differs
from the contract. Go through the contract line by line: each line is at least one test.

## Hint 2
Cover each class separately: each unit alone (so a wrong weight shows up), combinations, and each
invalid kind (empty, unknown unit, out of order, repeated, spaces, missing number). Check the error
message, not only the exception type.

## Hint 3
Tests like `parse_duration("30m1h")`, `parse_duration("1h2h")` and `parse_duration("")` must raise;
`parse_duration("1m") == 60` and `parse_duration("1s") == 1` pin down the weights.
