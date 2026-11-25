# Predict the output: references, coercion and closures

## Problem

Read `program/main.mjs`. Do not run it. Write **exactly** what it prints into `starter/answer.txt`.

The program has three short blocks and prints three lines. They show how JavaScript treats arrays,
`+` and `-` on strings, and closures that a `var` loop creates.

## Program

- `program/main.mjs`. The tests run it with Node 24.

## Answer format

- Write one line for each line that the program prints, in the same order and exactly as printed.
- `console.log` puts one space between its arguments.
- Spaces at the end of a line and a newline at the end of the file are ignored. All other
  differences count.

## Examples

For `console.log([1] + [2], 1 + "1")`, the answer is:

```
12 11
```

## Constraints

- Do not run the program. The task is to *read* it.
- `ginga test` tells you which lines are wrong. It never tells you the correct lines.

## How to run

- `ginga test` checks your answer.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all lines match.
