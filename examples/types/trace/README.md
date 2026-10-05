# Predict the output: references, coercion and closures

## Problem

Read `program/main.mjs` and write **exactly** what it prints into `starter/answer.txt`, without
running it. Three short blocks, three lines of output: what do they say about how JavaScript treats
arrays, `+`/`-` on strings, and closures created in a `var` loop?

## Program

- `program/main.mjs` (run with Node 24 by the tests).

## Answer format

- One line per line the program prints, in order, exactly as printed (`console.log` separates its
  arguments with single spaces).
- Trailing spaces and a final newline don't matter; everything else does.

## Examples

For `console.log([1] + [2], 1 + "1")` the answer would be:

```
12 11
```

## Constraints

- Don't run it: the point is to *read* it. `ginga test` tells you which lines are wrong, never what
  they should be.

## How to run

- `ginga test` checks your answer.
- `ginga hint` reveals one hint at a time.
- `ginga done` when every line matches.
