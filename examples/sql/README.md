# Paid orders per customer, including customers with none

## Problem

Write one SQLite query in `starter/solution.sql` that lists **every customer** with the number of
their paid orders and the total paid amount:

```sql
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL            -- 'paid', 'pending' or 'cancelled'
);
```

Result columns, in this order: `name`, `paid_orders`, `paid_cents`.

- Customers with no orders, or with no **paid** orders, appear with `0` and `0` (not `NULL`).
- Only orders with `status = 'paid'` count.
- Order by `paid_cents` descending, then `name` ascending.

## Examples

| customers | orders | result |
|---|---|---|
| (1, ana), (2, bo), (3, cy) | (10, 1, 500, paid), (11, 1, 250, paid), (12, 2, 999, pending) | (ana, 2, 750), (bo, 0, 0), (cy, 0, 0) |
| (1, ana) | (none) | (ana, 0, 0) |
| (none) | (none) | (no rows) |

## Constraints

- One `SELECT` statement (CTEs allowed). SQLite 3.46.

## How to run

- `ginga test` runs the query against the test datasets.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
