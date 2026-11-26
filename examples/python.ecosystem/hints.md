## Hint 1
Do three steps. Keep only the rows that count. Add them up for each customer. Then rank the
customers. Which pandas operation skips missing values when it adds them?

## Hint 2
Filter with a boolean mask on `status`. Then use `groupby("customer")["amount"].sum()`, which skips
NaN by default. Remove the totals that are 0 or less. To rank, sort by two keys in one call.

## Hint 3
`totals.reset_index().sort_values(["amount", "customer"], ascending=[False, True], kind="stable")`,
then `.head(n)` and build the tuples with `round(float(total), 2)`.
