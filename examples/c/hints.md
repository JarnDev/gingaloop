## Hint 1
Counting separators is a trap: what about two spaces in a row, or a space at the start? Think about
where words *begin* instead.

## Hint 2
Keep one flag: "am I inside a word?". A word begins exactly when you see a non-space character while
the flag is off.

## Hint 3
`for (; *s; s++) { if (isspace((unsigned char)*s)) in_word = 0; else if (!in_word) { in_word = 1; count++; } }`
