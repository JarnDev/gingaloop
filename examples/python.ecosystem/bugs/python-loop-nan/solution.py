import pandas as pd

REQUIRED = ("customer", "amount", "status")


def top_spenders(orders: pd.DataFrame, n: int) -> list[tuple[str, float]]:
    """Top n customers by total paid amount: [(customer, total), ...]."""
    if n < 0:
        raise ValueError(f"n must be >= 0, got {n}")
    for column in REQUIRED:
        if column not in orders.columns:
            raise ValueError(f"missing column: {column}")
    # BUG (plausible alternative): a plain loop with += turns a total into NaN as soon as one
    # amount is missing, and NaN > 0 is False, so that customer disappears.
    totals: dict[str, float] = {}
    for row in orders.itertuples(index=False):
        if row.status == "paid":
            totals[row.customer] = totals.get(row.customer, 0.0) + row.amount
    ranked = sorted(((c, t) for c, t in totals.items() if t > 0), key=lambda ct: (-ct[1], ct[0]))
    return [(c, round(float(t), 2)) for c, t in ranked[:n]]
