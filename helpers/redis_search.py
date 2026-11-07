"""RediSearch queries and result parsing. Every query uses DIALECT 4, under which a RETURN'd
JSONPath field comes back wrapped in a JSON array ('["x"]'); unwrap_field undoes that."""
import json
import re
from typing import Any

from redis.commands.search.query import Query
from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import RedisError, ResponseError
from redis.exceptions import TimeoutError as RedisTimeoutError

from helpers.errors import fail

_TAG_SPECIAL = re.compile(r"([,.<>{}\[\]\"':;!@#$%^&*()\-+=~|/\\ ?])")


def escape_tag(value: Any) -> str:
    """`value` escaped for use inside a TAG filter."""
    return _TAG_SPECIAL.sub(r"\\\1", str(value))


def tag_union(values) -> str:
    """A TAG union of `values`: "a|b|c"."""
    return "|".join(escape_tag(v) for v in values)


def plain_query(text: str, limit: int) -> Query:
    return Query(text).paging(0, limit).dialect(4)


async def search(index: Any, query: Query, params: dict | None = None) -> list:
    """The documents matching `query` (or fail with the reason)."""
    try:
        result = await index.search(query, query_params=params)
    except ResponseError as exc:
        fail(f"RediSearch bad query: {exc}")
    except (RedisConnectionError, RedisTimeoutError) as exc:
        fail(f"RediSearch network error: {exc}")
    except RedisError as exc:
        fail(f"RediSearch unexpected library error: {exc}")
    return result.docs


def doc_json(doc: Any) -> dict:
    """The JSON body of a search result document."""
    raw = getattr(doc, "json", None)
    if raw is None:
        fail("search result has no JSON body (is the index a JSON index?)")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError:
        fail("search result JSON could not be parsed")
    except TypeError as exc:
        fail(f"unexpected error while parsing JSON: {exc}")
    if isinstance(body, list):
        if not body:
            fail("search result JSON body is an empty array")
        body = body[0]
    if not isinstance(body, dict):
        fail(f"search result JSON body is not an object: {type(body).__name__}")
    return body


def unwrap_field(value: Any) -> Any:
    """A RETURN'd JSONPath field: '["x"]' -> "x", '[]' (path matched nothing) -> None."""
    if isinstance(value, str) and value.startswith("["):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return value
        if isinstance(parsed, list):
            return parsed[0] if parsed else None
    return value


def ip_from_score(doc: Any) -> float:
    """The IP from a KNN result's "score" (an IP distance, 1 - IP); NaN if unreadable."""
    try:
        return 1.0 - float(getattr(doc, "score", "nan"))
    except (TypeError, ValueError):
        return float("nan")
