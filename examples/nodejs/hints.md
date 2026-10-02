## Hint 1
Counting `\n` bytes gives the right answer for most files. Which file shape breaks that rule?

## Hint 2
`fs.createReadStream(path)` is async-iterable: `for await (const chunk of stream)` gives you
Buffers. Count newline bytes per chunk and remember the LAST byte you saw.

## Hint 3
`count += number of 0x0a bytes in chunk` (loop with `chunk.indexOf(10, from)`); after the loop,
`if (sawAnyByte && lastByte !== 10) count++`.
