# Top spenders from an orders table

## Problem

The finance team exports orders as a pandas DataFrame. It has three columns: `customer` (str),
`amount` (float, can be missing) and `status` (`"paid"` or `"refunded"`). Write
`top_spenders(orders: pd.DataFrame, n: int) -> list[tuple[str, float]]` in `starter/solution.py`.

- The total of a customer is the sum of the `amount` of the customer's **paid** orders.
- Refunded orders do not count. The function skips missing amounts. A missing amount is not an
  error.
- The result does not include customers with a total of 0 or less. This includes customers with no
  paid orders.
- The function returns the top `n` customers as `(customer, total)` tuples. It rounds each total to
  2 decimals.
- The order is by total, from highest to lowest. For equal totals, the order is by customer name,
  from A to Z.
- If `n` is larger than the number of customers, the function returns all of them. If `n == 0`, it
  returns `[]`.
- For a negative `n`, it raises `ValueError("n must be >= 0, got -1")`.
- For a missing column, it raises `ValueError("missing column: status")`. The message names the
  first missing column in this order: customer, amount, status.
- The function must not change the input DataFrame.

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

- Use pandas as you would at work. Do not use Python loops over rows.
- The input has at most 10^6 orders.
- The available libraries are numpy 2.1 and pandas 2.2. No other libraries are available.

## How to run

- `ginga test` runs the tests (pytest) against your `starter/`.
- `ginga hint` shows one hint at a time.
- `ginga done` records the solve when all tests pass.
