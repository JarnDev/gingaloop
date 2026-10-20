# What to test, item 4: empty text is rejected.
import unittest

from subject import parse_duration  # noqa: F401 (the tests you add use it)


class TestEmpty(unittest.TestCase):
    # TODO
    pass


if __name__ == "__main__":
    unittest.main()
