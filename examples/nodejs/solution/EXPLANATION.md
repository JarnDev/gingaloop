# Count lines with a stream: explanation

## Approach

`fs.createReadStream` reads the file in chunks (64 KiB by default) and is async-iterable, so
`for await` gives one `Buffer` at a time. Memory stays constant no matter how big the file is.

In each chunk we count `0x0a` bytes with `Buffer.indexOf`, which searches natively and doesn't decode
to a string. The only line *without* a newline is a final one, so we remember the last byte of the
file. If the file is non-empty and doesn't end in `\n`, we add one.

Trace for `"a\nb"`: one chunk `[61 0a 62]`, one newline → count 1; last byte `0x62` is not a newline
→ count 2.

## Complexity

O(n) time over the file's bytes, O(1) extra memory (one chunk at a time).

## Alternatives

- `readline.createInterface({ input: stream })` and counting `line` events is simpler to read, but it
  decodes to strings and allocates one string per line, which is noticeably slower on large files.
- `fs.readFile` plus `split("\n")` is the shortest, but it loads the whole file into memory.
- `split("\n").length` is also wrong for files ending in `\n`: it counts an extra empty "line".

## Common bugs

- **Missing the last line** (`bugs/misses-last-line`): only counting `\n` gives 1 for `"a\nb"`.
  Caught by "counts a last line without a trailing newline".
- **Empty file counts as one line** (`bugs/empty-file-counts-one`): checking "last byte isn't `\n`"
  without checking that there *was* a last byte. Caught by "an empty file has zero lines".
- **`split("\n").length`** (`bugs/split-length`): the classic one-liner counts an empty "line" after a final `\n` and returns 1 for an empty file, and it reads the whole file into memory. Caught by "counts newline-terminated lines".

## Idioms

- Readable streams are async iterables: `for await (const chunk of stream)` handles backpressure and
  errors (a missing file rejects the loop with `ENOENT`).
- Work on `Buffer`s with `indexOf(byte, from)` instead of `toString()` when you only need bytes.

## Level up

1. Also return the length of the longest line, still in one pass and constant memory (careful: lines
   can span chunks).
2. Support `\r\n` files so that a `\r` before `\n` isn't part of the line length.
