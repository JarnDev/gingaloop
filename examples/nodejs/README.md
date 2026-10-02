# Count lines with a stream

## Problem

A log viewer shows the number of lines in files that can be several gigabytes, so reading the whole
file into memory is not an option. Implement `countLines(path)` in `starter/solution.mjs`. It returns
a `Promise<number>` with the number of lines, reading the file as a stream.

A line is a sequence of characters terminated by `\n`, **or** the final characters of the file when
the file does not end with `\n`. An empty file has 0 lines. A missing file rejects the promise with
the original `ENOENT` error.

## Examples

| File contents | Result |
|---|---|
| `"a\nb\n"` | 2 |
| `"a\nb"` | 2 |
| `""` | 0 |
| `"\n\n"` | 2 |

## Constraints

- Memory use must not grow with the file size (stream it, don't `readFile` it).
- Count bytes in Buffers; don't convert every chunk to a string.
- Node.js standard library only.

## How to run

- `ginga test` runs the tests against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
