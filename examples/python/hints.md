## Hint 1
Encoding is "walk the string and notice when the character changes". What do you still have to do
after the loop ends?

## Hint 2
For encoding, keep the current character and its count; flush `char + str(count)` whenever the
character changes and once more at the end. For decoding, read one character, then read ALL the
digits that follow it.

## Hint 3
Decode loop: `i` points at a character; `j = i + 1`; advance `j` while `encoded[j].isdigit()`;
the count is `int(encoded[i+1:j])` (error if empty or zero); append `char * count`; `i = j`.
