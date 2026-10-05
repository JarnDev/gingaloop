## Hint 1
For each block, ask: is a new value created, or is the same one reached by two names? Is `+` adding
or joining? Which `i` does each arrow function see?

## Hint 2
`const b = a` copies the *reference*, while `[...a]` makes a new array. `+` with a string operand
concatenates; `-` always converts to numbers. `var` has one binding for the whole loop.

## Hint 3
Line 1 counts lengths after both pushes reached `a` through `b`; line 2 is `"53"`, `2` and their
`typeof`s; line 3 calls three functions that all read the single `i` after the loop ended.
