import json
import os
import sqlite3
import unittest

HERE = os.path.dirname(__file__)
QUERY_FILE = os.path.join(HERE, "..", os.environ.get("TARGET", "starter"), "solution.sql")


def run(customers, orders):
    db = sqlite3.connect(":memory:")
    with open(os.path.join(HERE, "schema.sql")) as f:
        db.executescript(f.read())
    db.executemany("INSERT INTO customers VALUES (?, ?)", customers)
    db.executemany("INSERT INTO orders VALUES (?, ?, ?, ?)", orders)
    with open(QUERY_FILE) as f:
        rows = db.execute(f.read()).fetchall()
    db.close()
    return [list(r) for r in rows]


class TestPaidOrders(unittest.TestCase):
    def test_counts_and_sums_paid_orders(self):
        got = run([(1, "ana"), (2, "bo")], [(10, 1, 500, "paid"), (11, 1, 250, "paid"), (12, 2, 100, "paid")])
        self.assertEqual(got, [["ana", 2, 750], ["bo", 1, 100]])

    def test_customers_without_orders_are_listed(self):
        got = run([(1, "ana"), (2, "bo")], [(10, 1, 500, "paid")])
        self.assertEqual(got, [["ana", 1, 500], ["bo", 0, 0]], "every customer appears, even with no orders")

    def test_zero_orders_counts_as_zero(self):
        self.assertEqual(run([(1, "ana")], []), [["ana", 0, 0]], "count the orders, not the joined row")

    def test_customers_with_only_unpaid_orders_are_listed(self):
        got = run([(1, "ana"), (2, "bo")], [(10, 1, 500, "paid"), (11, 2, 900, "pending"), (12, 2, 50, "cancelled")])
        self.assertEqual(got, [["ana", 1, 500], ["bo", 0, 0]], "unpaid orders don't count, but bo is still a customer")

    def test_ties_are_ordered_by_name(self):
        got = run([(1, "zed"), (2, "amy"), (3, "mo")], [(10, 1, 300, "paid"), (11, 2, 300, "paid")])
        self.assertEqual(got, [["amy", 1, 300], ["zed", 1, 300], ["mo", 0, 0]])

    def test_columns_are_named_and_ordered(self):
        db = sqlite3.connect(":memory:")
        with open(os.path.join(HERE, "schema.sql")) as f:
            db.executescript(f.read())
        with open(QUERY_FILE) as f:
            cursor = db.execute(f.read())
        self.assertEqual([d[0] for d in cursor.description], ["name", "paid_orders", "paid_cents"])

    def test_empty_tables_give_no_rows(self):
        self.assertEqual(run([], []), [])

    def test_golden_datasets(self):
        with open(os.path.join(HERE, "cases.json")) as f:
            cases = json.load(f)
        for i, case in enumerate(cases):
            got = run([tuple(c) for c in case["customers"]], [tuple(o) for o in case["orders"]])
            self.assertEqual(got, case["expected"], f"dataset #{i}: {case}")


if __name__ == "__main__":
    unittest.main()
