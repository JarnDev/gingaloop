## Hint 1
To encode, go through the string and find each position where the character changes. What must you
do after the loop ends?

## Hint 2
To encode, keep the current character and its count. Add `char + str(count)` to the result each
time the character changes, and one more time at the end. To decode, read one character. Then read
ALL the digits after it.

## Hint 3
Decode loop: `i` points at a character; `j = i + 1`; advance `j` while `encoded[j].isdigit()`;
the count is `int(encoded[i+1:j])` (error if empty or zero); append `char * count`; `i = j`.
