"""Ids that may be stored as int in one place and as str in another (Redis TAG values are
always strings, MongoDB and Postgres keep their own types)."""
import contextlib
from typing import Any


def id_variants(value: Any) -> list:
    """`value` plus its str and int forms, to match an id whatever type it was stored as."""
    variants = [value, str(value)]
    with contextlib.suppress(ValueError):
        variants.append(int(str(value)))
    return list(dict.fromkeys(variants))


def as_id_list(value: Any) -> list[str]:
    """A list-of-ids field as strings: None -> [], a scalar -> [it]."""
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(v) for v in value if v is not None]
    return [str(value)]


def is_blank_id(value: Any) -> bool:
    """None or an empty / whitespace-only id."""
    return value is None or (isinstance(value, str) and not value.strip())
