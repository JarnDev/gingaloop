## Hint 1
The function loses exactly one line in two, but each line is valid. So some state stays from one
line to the next. Which state can that be?

## Hint 2
Find each value that is defined *outside* the function and that the loop uses again and again.
Then read the documentation: how does that value behave when you use it again?

## Hint 3
`LINE` is a regex with the `g` flag. With `g`, `RegExp.prototype.exec` starts its search at
`LINE.lastIndex` and changes `lastIndex` after each match. So the search in the next string starts
at the wrong position.
