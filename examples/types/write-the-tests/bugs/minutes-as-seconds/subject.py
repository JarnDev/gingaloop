import re

_PART = re.compile(r"(\d+)([hms])")
_WEIGHT = {"h": 3600, "m": 1, "s": 1}  # BUG: minutes counted as seconds
_ORDER = "hms"


def parse_duration(text: str) -> int:
    """'1h30m' -> 5400 seconds. Units h, m, s, in that order, each at most once."""
    pos = 0
    total = 0
    last_unit = -1
    while pos < len(text):
        match = _PART.match(text, pos)
        if not match:
            raise ValueError(f"invalid duration: {text!r}")
        number, unit = match.groups()
        order = _ORDER.index(unit)
        if order <= last_unit:
            raise ValueError(f"invalid duration: {text!r}")
        last_unit = order
        total += int(number) * _WEIGHT[unit]
        pos = match.end()
    if pos == 0:
        raise ValueError(f"invalid duration: {text!r}")
    return total
