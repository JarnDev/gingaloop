## Hint 1
Do not count separators. Two spaces in sequence, or a space at the start, give a wrong count.
Find where each word *starts* instead.

## Hint 2
Keep one flag: "is the current character in a word?". A word starts when the character is not a
space and the flag is off.

## Hint 3
`for (; *s; s++) { if (isspace((unsigned char)*s)) in_word = 0; else if (!in_word) { in_word = 1; count++; } }`
