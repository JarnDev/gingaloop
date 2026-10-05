## Hint 1
"Every customer, even without orders" is a sentence about which join keeps rows from one side even
when there's no match.

## Hint 2
`LEFT JOIN` customers to orders, then aggregate per customer. Be careful *where* you filter on
`status`: a condition in `WHERE` on the right-hand table runs after the join and throws away the
unmatched customers again.

## Hint 3
Put `o.status = 'paid'` in the `ON` clause, count `o.id` (not `*`), and wrap the sum in
`COALESCE(..., 0)`. `GROUP BY c.id, c.name`.
