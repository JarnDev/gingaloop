# Top spenders: explanation

## Approach

Filter, aggregate, rank: each step is one vectorized pandas operation.

1. **Filter** the rows that count with a boolean mask: `orders["status"] == "paid"`.
2. **Aggregate** per customer with `groupby("customer")["amount"].sum()`. pandas' `sum` skips `NaN`
   by default (`skipna=True`), which is exactly "missing amounts are ignored".
3. **Drop** totals that are not positive, then **rank** with one `sort_values` on two keys: total
   descending, customer ascending. `kind="stable"` keeps the result deterministic.

Trace for the README example: paid rows are ana 30.0, bo 50.0, ana 25.5, bo NaN (cy is refunded).
Sums: ana 55.5, bo 50.0 (NaN skipped). Sorted: ana 55.5, bo 50.0.

## Complexity

O(n) for the mask and the group sums, plus O(k log k) to sort the k customers. Memory is O(n) for
the filtered view.

## Alternatives

- `totals.nlargest(n)` is shorter, but its ties follow first appearance, not the name, so it breaks
  the tie rule (see the bugs below).
- A Python loop over `itertuples()` is easy to read, but it's 50–100× slower on a million rows, and
  `+=` with a `NaN` silently turns the whole total into `NaN`.
- `pivot_table(index="customer", values="amount", aggfunc="sum")` works too, but it's more machinery
  for a single aggregate.

## Common bugs

- **Counting refunds** (`bugs/includes-refunds`): forgetting the status filter. Caught by
  `test_refunded_orders_are_not_counted`.
- **Keeping zero totals** (`bugs/keeps-zero-totals`): customers with only `0.0` or `NaN` paid orders
  stay in the ranking. Caught by `test_customers_with_nothing_paid_are_left_out`.
- **`nlargest` for the ranking** (`bugs/nlargest-tie-order`): correct totals, wrong order on ties.
  Caught by `test_ties_are_broken_alphabetically`.
- **A plain loop with `+=`** (`bugs/python-loop-nan`): one missing amount makes the total `NaN`, and
  `NaN > 0` is `False`, so the customer vanishes. Caught by `test_missing_amounts_are_ignored`.

## Idioms

- `df.loc[mask, columns]` filters rows and selects columns in one step, without chained indexing.
- `groupby(..., sort=False)` skips an unneeded sort when you sort the result anyway.
- `sort_values([a, b], ascending=[False, True], kind="stable")` for multi-key ranking.
- `pandas.testing.assert_frame_equal` and `pytest.approx` for comparing data in tests.

## Level up

1. Return a DataFrame with a `rank` column where ties share a rank (`rank(method="min")`).
2. Accept a date range and an `as_of` time zone, summing only orders inside it (`pd.Timestamp`,
   `tz_convert`).
