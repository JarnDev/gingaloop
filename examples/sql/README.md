# Paid orders per customer, including customers with none

## Problem

Write one SQLite query in `starter/solution.sql`. It lists **all customers**, each with the number
of paid orders and the total paid amount:

```sql
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL            -- 'paid', 'pending' or 'cancelled'
);
```

The result has these columns, in this order: `name`, `paid_orders`, `paid_cents`.

- Only orders with `status = 'paid'` count.
- A customer with no orders, or with no **paid** orders, is in the result with `0` and `0`, not
  `NULL`.
- Sort by `paid_cents`, from highest to lowest. For equal values, sort by `name`, from A to Z.

## Examples

| customers | orders | result |
|---|---|---|
| (1, ana), (2, bo), (3, cy) | (10, 1, 500, paid), (11, 1, 250, paid), (12, 2, 999, pending) | (ana, 2, 750), (bo, 0, 0), (cy, 0, 0) |
| (1, ana) | (none) | (ana, 0, 0) |
| (none) | (none) | (no rows) |

## Constraints

- Write one `SELECT` statement. You can use CTEs.
- The tests use SQLite 3.46.

## How to run

- `ginga test` runs the query against the test datasets.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
