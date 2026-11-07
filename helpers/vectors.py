"""Vector and distance maths. Every stored vector is unit length, so an inner product (IP)
of two of them is their cosine."""
import math
from typing import Any

import numpy as np

from helpers.errors import fail, require

DTYPE = np.float32
NORM_EPS = 1e-8
EARTH_RADIUS_KM = 6371.0


def to_vector(raw: Any, name: str) -> np.ndarray:
    """`raw` as a non-empty 1-D float32 array (or fail)."""
    require(raw, name)
    try:
        arr = np.asarray(raw, dtype=DTYPE)
    except (TypeError, ValueError):
        fail(f"{name} is not a numeric vector")
    if arr.ndim != 1 or arr.size == 0:
        fail(f"{name} must be a non-empty 1-D vector")
    return arr


def normalize(vec: np.ndarray) -> np.ndarray | None:
    """`vec` scaled to unit length, or None if it is (numerically) zero."""
    norm = float(np.linalg.norm(vec))
    if norm < NORM_EPS:
        return None
    return (vec / norm).astype(DTYPE)


def to_blob(vec: np.ndarray) -> bytes:
    """`vec` as the raw float32 bytes RediSearch KNN queries take."""
    return np.asarray(vec, dtype=DTYPE).tobytes()


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in km between two (lat, lon) points."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = (math.sin((lat2 - lat1) / 2) ** 2
         + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(h)))
