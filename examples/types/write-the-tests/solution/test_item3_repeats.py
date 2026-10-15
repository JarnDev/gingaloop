# What to test, item 3: a repeated unit is rejected.
import unittest

from subject import parse_duration


class TestRepeats(unittest.TestCase):
    def test_repeated_unit_is_rejected(self):
        for text in ("1h2h", "1m1m", "1h1m1m"):
            with self.assertRaises(ValueError):
                parse_duration(text)


if __name__ == "__main__":
    unittest.main()
