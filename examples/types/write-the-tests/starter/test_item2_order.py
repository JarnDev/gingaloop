# What to test, item 2: units out of order are rejected.
import unittest

from subject import parse_duration  # noqa: F401 (the tests you add use it)


class TestOrder(unittest.TestCase):
    # TODO
    pass


if __name__ == "__main__":
    unittest.main()
