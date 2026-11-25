## Hint 1
For each block, ask three questions. Does the code make a new value, or do two names point to the
same value? Does `+` add numbers or join strings? Which `i` does each arrow function see?

## Hint 2
`const b = a` copies the *reference*. `[...a]` makes a new array. When one operand of `+` is a
string, `+` joins strings. `-` always converts its operands to numbers. A `var` loop has one `i`
for the whole loop.

## Hint 3
Line 1 shows the lengths after both pushes changed `a` through `b`. Line 2 shows `"53"`, `2` and
their `typeof` values. Line 3 calls three functions. All three read the same `i`, after the loop
ended.
