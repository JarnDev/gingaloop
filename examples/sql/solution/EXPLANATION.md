# Paid orders per customer: explanation

## Approach

"Every customer, even without matches" means a **LEFT JOIN** from `customers` to `orders`. The key
detail is *where* the `status` filter goes:

- In the **`ON`** clause, it decides which orders match. Customers without paid orders still get one
  row, with `NULL` order columns.
- In **`WHERE`**, it runs *after* the join and throws away those `NULL` rows, turning the LEFT JOIN
  back into an inner one.

Then aggregate per customer: `COUNT(o.id)` counts only non-`NULL` ids (0 for no match), and
`SUM` of nothing is `NULL`, hence `COALESCE(..., 0)`. Order by total, then name, so ties are
deterministic.

Trace for bo with one `pending` order: the join finds no paid order, so the row is `(bo, NULL…)`;
`COUNT(o.id)` = 0 and `SUM` = `NULL`, which becomes 0. The result is `(bo, 0, 0)`.

## Complexity

One pass over both tables with a hash or index join: O(customers + orders). An index on
`orders(customer_id, status)` makes the join a cheap lookup on large tables.

## Alternatives

- A correlated subquery per customer (`(SELECT COUNT(*) FROM orders WHERE ...)`) is correct and
  readable, but it's two subqueries per row and harder for the planner.
- A CTE that pre-aggregates paid orders, then `LEFT JOIN`s it: great when you need several stats
  from `orders`.
- `SUM(CASE WHEN o.status = 'paid' THEN o.amount_cents END)` with the filter in the aggregate
  works too, and lets you compute paid and pending side by side.

## Common bugs

- **`JOIN` instead of `LEFT JOIN`** (`bugs/inner-join`): customers with no paid orders disappear.
  Caught by `test_customers_without_orders_are_listed`.
- **`COUNT(*)`** (`bugs/count-star`): counts the single `NULL` row of an orderless customer as 1.
  Caught by `test_zero_orders_counts_as_zero`.
- **Filtering in `WHERE`** (`bugs/filter-in-where`): even with the `OR o.id IS NULL` patch, a
  customer whose only orders are unpaid matches *something*, so their row is filtered out. Caught by
  `test_customers_with_only_unpaid_orders_are_listed`.

## Idioms

- Conditions on the optional side of a LEFT JOIN belong in `ON`.
- `COUNT(column)` vs `COUNT(*)`: the former skips `NULL`s.
- Always add a tie-breaker to `ORDER BY` when the first key can repeat.

## Level up

1. Add each customer's **rank** by paid total with `RANK()` (window function), ties sharing a rank.
2. Show customers whose paid total dropped compared to the previous month (CTE + `LAG`).
