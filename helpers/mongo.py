"""MongoDB documents and aggregation expressions."""
import re

from bson import ObjectId
from fastapi.encoders import jsonable_encoder

from helpers.vectors import EARTH_RADIUS_KM


def to_json(doc: dict) -> dict:
    """`doc` made JSON-safe: `_id` becomes `id`, every ObjectId (nested too) a string."""
    doc["id"] = doc.pop("_id")
    return jsonable_encoder(doc, custom_encoder={ObjectId: str})


def text_match_expr(query: str) -> dict | None:
    """An $expr that is true when any query word appears (case-insensitive) in any top-level
    string field. Fields are read dynamically, so new string fields are searched too.
    None when the query has no words."""
    words = query.split()
    if not words:
        return None
    pattern = "|".join(re.escape(w) for w in words)
    return {"$anyElementTrue": {"$map": {
        "input": {"$objectToArray": "$$ROOT"},
        "as": "f",
        "in": {"$cond": [
            {"$eq": [{"$type": "$$f.v"}, "string"]},
            {"$regexMatch": {"input": "$$f.v", "regex": pattern, "options": "i"}},
            False,
        ]},
    }}}


def distance_km_expr(lat: float, lon: float) -> dict:
    """Haversine distance (km) from (lat, lon) to the document's `lat` / `lon` fields."""
    lat1, lat2 = {"$degreesToRadians": lat}, {"$degreesToRadians": "$lat"}
    half_dlat = {"$divide": [{"$degreesToRadians": {"$subtract": ["$lat", lat]}}, 2]}
    half_dlon = {"$divide": [{"$degreesToRadians": {"$subtract": ["$lon", lon]}}, 2]}
    a = {"$add": [
        {"$pow": [{"$sin": half_dlat}, 2]},
        {"$multiply": [{"$cos": lat1}, {"$cos": lat2}, {"$pow": [{"$sin": half_dlon}, 2]}]},
    ]}
    # $min keeps float error from pushing sqrt(a) just above 1, outside asin's domain
    return {"$multiply": [2 * EARTH_RADIUS_KM, {"$asin": {"$min": [1, {"$sqrt": a}]}}]}
