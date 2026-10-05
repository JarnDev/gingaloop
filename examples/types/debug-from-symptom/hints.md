## Hint 1
It loses exactly every other line, even though each line is valid on its own. Something must
survive from one line to the next. What state could that be?

## Hint 2
Look for anything defined *outside* the function that the loop keeps reusing, and read the
documentation of how it behaves when it's reused.

## Hint 3
`LINE` is a regex with the `g` flag. `RegExp.prototype.exec` with `g` starts searching at
`LINE.lastIndex` and updates it after each match, so the next string is searched from the wrong
position.
