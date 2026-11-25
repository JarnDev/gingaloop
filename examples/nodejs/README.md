# Count lines with a stream

## Problem

A log viewer shows the number of lines in a file. A file can be several gigabytes, so the code
must not read all of the file into memory. Write `countLines(path)` in `starter/solution.mjs`. It
reads the file as a stream and returns a `Promise<number>` with the number of lines.

- A line is a sequence of characters that ends with `\n`.
- If the file does not end with `\n`, the characters after the last `\n` are also a line.
- An empty file has 0 lines.
- If the file does not exist, the promise rejects with the original `ENOENT` error.

## Examples

| File contents | Result |
|---|---|
| `"a\nb\n"` | 2 |
| `"a\nb"` | 2 |
| `""` | 0 |
| `"\n\n"` | 2 |

## Constraints

- The memory use must stay the same for all file sizes. Read the file as a stream, not with
  `readFile`.
- Count the bytes in the Buffers. Do not convert the chunks to strings.
- Use only the Node.js standard library.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
