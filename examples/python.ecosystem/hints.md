## Hint 1
Three steps: keep only the rows that count, add them up per customer, then rank. Which pandas
operation already skips missing values when summing?

## Hint 2
Filter with a boolean mask on `status`, then `groupby("customer")["amount"].sum()` (it skips NaN by
default). Drop totals that are not positive. For the ranking, sort by two keys at once.

## Hint 3
`totals.reset_index().sort_values(["amount", "customer"], ascending=[False, True], kind="stable")`,
then `.head(n)` and build the tuples with `round(float(total), 2)`.
