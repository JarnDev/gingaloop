# Top spenders from an orders table

## Problem

The finance team exports orders as a pandas DataFrame with the columns `customer` (str), `amount`
(float, possibly missing) and `status` (`"paid"` or `"refunded"`). Implement
`top_spenders(orders: pd.DataFrame, n: int) -> list[tuple[str, float]]` in `starter/solution.py`:

- A customer's total is the sum of the `amount` of their **paid** orders. Refunded orders don't
  count, and missing amounts are ignored (not treated as zero errors, just skipped).
- Customers whose total is `0` (or who have no paid orders) are left out.
- Return the top `n` as `(customer, total)` tuples, the total rounded to 2 decimals, ordered by total
  descending; ties are ordered by customer name ascending.
- `n` larger than the number of customers returns all of them; `n == 0` returns `[]`.
- A negative `n` raises `ValueError("n must be >= 0, got -1")`; a missing column raises
  `ValueError("missing column: status")` (naming the first missing one in the order
  customer, amount, status).
- The input DataFrame must not be modified.

## Examples

```python
>>> orders = pd.DataFrame({
...     "customer": ["ana", "bo", "ana", "cy", "bo"],
...     "amount":   [30.0, 50.0, 25.5, 50.0, None],
...     "status":   ["paid", "paid", "paid", "refunded", "paid"],
... })
>>> top_spenders(orders, 2)
[('ana', 55.5), ('bo', 50.0)]
>>> top_spenders(orders, 10)
[('ana', 55.5), ('bo', 50.0)]
>>> top_spenders(orders, 0)
[]
>>> top_spenders(orders.drop(columns="status"), 1)
Traceback (most recent call last):
ValueError: missing column: status
```

## Constraints

- Use pandas the way you would at work: no Python loops over rows.
- Up to 10^6 orders.
- Available: numpy 2.1, pandas 2.2 (nothing else).

## How to run

- `ginga test` runs the tests (pytest) against your `starter/`.
- `ginga hint` reveals one hint at a time.
- `ginga done` when everything is green.
