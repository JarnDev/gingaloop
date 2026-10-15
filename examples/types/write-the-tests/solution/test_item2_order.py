# What to test, item 2: units out of order are rejected.
import unittest

from subject import parse_duration


class TestOrder(unittest.TestCase):
    def test_units_out_of_order_are_rejected(self):
        for text in ("30m1h", "5s2m", "1s1h"):
            with self.assertRaises(ValueError):
                parse_duration(text)


if __name__ == "__main__":
    unittest.main()
