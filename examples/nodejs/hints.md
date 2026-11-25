## Hint 1
For most files, the number of `\n` bytes is the correct answer. For which type of file is it wrong?

## Hint 2
`fs.createReadStream(path)` is async-iterable: `for await (const chunk of stream)` gives you
Buffers. Count the newline bytes in each chunk. Also keep the LAST byte that you read.

## Hint 3
`count += number of 0x0a bytes in chunk` (loop with `chunk.indexOf(10, from)`). After the loop:
`if (sawAnyByte && lastByte !== 10) count++`.
