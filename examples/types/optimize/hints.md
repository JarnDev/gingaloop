## Hint 1
For each number `x`, only one partner value is possible: `target - x`. How fast can you find how
many of those partners you saw before?

## Hint 2
Go through the list one time. Keep a count of each value that you saw before (a dict or
`collections.Counter`). Each new number makes a pair with each earlier copy of its partner.

## Hint 3
`seen = Counter(); total = 0; for x in nums: total += seen[target - x]; seen[x] += 1; return total`.
You count the partners before you add `x`. This stops an element from making a pair with itself.
