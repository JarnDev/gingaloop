Harness for write-the-tests: `test.command` runs the suite in `../$TESTS` (your `starter/`, or the
reference `solution/`) with the implementation in `../$IMPL` (`subject/` or a hidden buggy version)
on `PYTHONPATH`, so `from subject import parse_duration` resolves to whichever is under test.
