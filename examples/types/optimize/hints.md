## Hint 1
For each number, the partner it needs is fully determined: `target - x`. How fast can you know how
many of those you've already seen?

## Hint 2
Walk once and keep a count of the values seen so far (a dict or `collections.Counter`). Each new
number pairs with every earlier occurrence of its partner.

## Hint 3
`seen = Counter(); total = 0; for x in nums: total += seen[target - x]; seen[x] += 1; return total`.
Counting before adding `x` is what stops an element from pairing with itself.
