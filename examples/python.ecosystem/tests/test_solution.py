import json
import os
import sys

import pandas as pd
import pytest
from pandas.testing import assert_frame_equal

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", os.environ.get("TARGET", "starter")))
from solution import top_spenders  # noqa: E402


def orders(rows):
    return pd.DataFrame(rows, columns=["customer", "amount", "status"])


def test_ranks_by_total_paid():
    df = orders([("ana", 30.0, "paid"), ("bo", 50.0, "paid"), ("ana", 25.5, "paid")])
    assert top_spenders(df, 2) == [("ana", 55.5), ("bo", 50.0)]


def test_refunded_orders_are_not_counted():
    df = orders([("ana", 10.0, "paid"), ("bo", 5.0, "paid"), ("bo", 100.0, "refunded")])
    assert top_spenders(df, 5) == [("ana", 10.0), ("bo", 5.0)], "refunds must not add to a total"


def test_missing_amounts_are_ignored():
    df = orders([("ana", None, "paid"), ("ana", 12.0, "paid"), ("bo", 3.0, "paid")])
    assert top_spenders(df, 5) == [("ana", 12.0), ("bo", 3.0)], "a missing amount is skipped, not a reason to drop the customer"


def test_ties_are_broken_alphabetically():
    # "zed" appears first, so first-appearance order would put it before "amy".
    df = orders([("zed", 20.0, "paid"), ("amy", 20.0, "paid"), ("mo", 30.0, "paid")])
    assert top_spenders(df, 3) == [("mo", 30.0), ("amy", 20.0), ("zed", 20.0)]


def test_customers_with_nothing_paid_are_left_out():
    df = orders([("ana", 0.0, "paid"), ("bo", 7.0, "refunded"), ("cy", None, "paid"), ("di", 1.0, "paid")])
    assert top_spenders(df, 5) == [("di", 1.0)]


def test_n_limits_and_zero():
    df = orders([("a", 1.0, "paid"), ("b", 2.0, "paid")])
    assert top_spenders(df, 10) == [("b", 2.0), ("a", 1.0)]
    assert top_spenders(df, 0) == []


def test_totals_are_rounded_to_cents():
    df = orders([("ana", 0.1, "paid"), ("ana", 0.2, "paid")])
    assert top_spenders(df, 1) == [("ana", 0.3)], "0.1 + 0.2 is 0.30000000000000004 before rounding"


def test_negative_n_raises_with_message():
    with pytest.raises(ValueError, match=r"^n must be >= 0, got -1$"):
        top_spenders(orders([]), -1)


def test_missing_column_raises_with_message():
    df = orders([("ana", 1.0, "paid")]).drop(columns=["amount", "status"])
    with pytest.raises(ValueError, match=r"^missing column: amount$"):
        top_spenders(df, 1)


def test_input_is_not_modified():
    df = orders([("ana", None, "paid"), ("bo", 2.0, "refunded")])
    before = df.copy()
    top_spenders(df, 3)
    assert_frame_equal(df, before)


def test_golden_cases():
    with open(os.path.join(os.path.dirname(__file__), "cases.json")) as f:
        cases = json.load(f)
    for case in cases:
        got = top_spenders(orders([tuple(r) for r in case["rows"]]), case["n"])
        assert [list(t) for t in got] == case["expected"], f"rows={case['rows']} n={case['n']}"
