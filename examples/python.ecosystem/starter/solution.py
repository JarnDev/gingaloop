import pandas as pd


def top_spenders(orders: pd.DataFrame, n: int) -> list[tuple[str, float]]:
    """Top n customers by total paid amount: [(customer, total), ...]."""
    raise NotImplementedError("top_spenders")
