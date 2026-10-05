import pandas as pd

REQUIRED = ("customer", "amount", "status")


def top_spenders(orders: pd.DataFrame, n: int) -> list[tuple[str, float]]:
    """Top n customers by total paid amount: [(customer, total), ...]."""
    if n < 0:
        raise ValueError(f"n must be >= 0, got {n}")
    for column in REQUIRED:
        if column not in orders.columns:
            raise ValueError(f"missing column: {column}")
    paid = orders.loc[orders["status"] == "paid", ["customer", "amount"]]
    totals = paid.groupby("customer", sort=False)["amount"].sum()
    totals = totals[totals > 0]
    # BUG (plausible alternative): nlargest keeps ties in order of first appearance,
    # not alphabetically.
    return [(customer, round(float(total), 2)) for customer, total in totals.nlargest(n).items()]
