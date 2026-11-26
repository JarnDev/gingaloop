## Hint 1
"All customers, also customers without orders": which join keeps the rows of one side when the
other side has no match?

## Hint 2
Use a `LEFT JOIN` from customers to orders. Then aggregate for each customer. Be careful *where*
you filter on `status`. A `WHERE` condition on the right-hand table runs after the join. It removes
the customers without a match again.

## Hint 3
Put `o.status = 'paid'` in the `ON` clause. Count `o.id`, not `*`. Put the sum in
`COALESCE(..., 0)`. Use `GROUP BY c.id, c.name`.
