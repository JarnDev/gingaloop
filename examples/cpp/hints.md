## Hint 1
Separate "finding the words" from "joining them backwards". What is a cheap way to refer to a word
without copying it?

## Hint 2
Scan `s` once and collect each word as a `std::string_view` into a vector (skip runs of spaces).
Then build the result by walking that vector from the back.

## Hint 3
`while (i < n) { skip spaces; j = i; advance j while s[j] != ' '; if (j > i) words.push_back(s.substr(i, j - i)); i = j; }`
then append words in reverse with `" "` between them.
