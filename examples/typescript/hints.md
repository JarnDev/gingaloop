## Hint 1
Do two steps: count the words (one pass), then rank the different words (a sort). When two words
have the same count, which word comes first?

## Hint 2
Make the text lowercase with `toLowerCase()`. Find the words with a global regex (`/[a-z']+/g`) and
count them in a `Map<string, number>`. Then sort the entries: compare the counts first, then the
words.

## Hint 3
`[...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, limit)`
