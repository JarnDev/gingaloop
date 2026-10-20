# What to test, item 3: a repeated unit is rejected.
import unittest

from subject import parse_duration  # noqa: F401 (the tests you add use it)


class TestRepeats(unittest.TestCase):
    # TODO
    pass


if __name__ == "__main__":
    unittest.main()
