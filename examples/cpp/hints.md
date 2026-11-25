## Hint 1
Do two separate steps: find the words, then join them in reverse order. How can you refer to a word
without a copy of it?

## Hint 2
Read `s` one time. Put each word into a vector as a `std::string_view`, and skip each sequence of
spaces. Then make the result from the vector, from the last word to the first.

## Hint 3
`while (i < n) { skip spaces; j = i; advance j while s[j] != ' '; if (j > i) words.push_back(s.substr(i, j - i)); i = j; }`
then append words in reverse with `" "` between them.
