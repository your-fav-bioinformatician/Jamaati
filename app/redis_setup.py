"""Startup: mirror the vector collections from MongoDB into RedisJSON, keep the RediSearch
indexes in line with the schemas below, and compute the mean major vector.

Bump SCHEMA_VERSION whenever a schema changes: the next startup then drops the indexes,
re-copies every document and re-creates them.
"""
import asyncio
import logging
from typing import Any

import numpy as np
from redis.commands.search.field import NumericField, TagField, VectorField
from redis.commands.search.index_definition import IndexDefinition, IndexType
from redis.exceptions import ResponseError

from app import config

log = logging.getLogger(__name__)

VECTOR_DIM = 768
SCHEMA_VERSION = "6"
SCHEMA_VERSION_KEY = "meta:schema_version"
INDEXING_TIMEOUT_S = 60
BATCH = 500

_VECTOR_PARAMS = {"TYPE": "FLOAT32", "DIM": VECTOR_DIM, "DISTANCE_METRIC": "IP"}

# The aliases (as_name) are the @fields the engine queries.
MBTI_SCHEMA = (
    TagField("$.mbti", as_name="mbti"),
)

CONCEPT_SCHEMA = (
    TagField("$.id", as_name="id"),
    TagField("$.relative_majors[*]", as_name="relative_majors"),  # one tag per array item
    VectorField("$.concept_vector", "FLAT", _VECTOR_PARAMS, as_name="concept_vector"),
)

MAJOR_SCHEMA = (
    TagField("$.dept_id", as_name="dept_id"),
    TagField("$.eligibility.hs", as_name="elig_hs"),
    TagField("$.eligibility.gender", as_name="elig_gender"),
    NumericField("$.eligibility.gpa", as_name="elig_gpa"),
    VectorField("$.vector", "FLAT", _VECTOR_PARAMS, as_name="vector"),
)

# (index name, Redis key prefix, schema, MongoDB collection)
INDEXES = [
    (config.MBTI_INDEX, "mbti:", MBTI_SCHEMA, config.MBTI_VECTORS_COLLECTION),
    (config.CONCEPT_INDEX, "concept:", CONCEPT_SCHEMA, config.CONCEPT_VECTORS_COLLECTION),
    (config.MAJOR_INDEX, "major:", MAJOR_SCHEMA, config.MAJOR_VECTORS_COLLECTION),
]


async def prepare_redis(redis_client: Any, db: Any) -> None:
    """Make every index match its schema and hold every MongoDB document."""
    stored = await redis_client.get(SCHEMA_VERSION_KEY)
    if isinstance(stored, bytes):
        stored = stored.decode()
    rebuild = stored != SCHEMA_VERSION

    for index_name, prefix, schema, collection in INDEXES:
        await _sync_index(redis_client, db, index_name, prefix, schema, collection, rebuild)
    # only once every index succeeded, so a failed startup rebuilds again next time
    await redis_client.set(SCHEMA_VERSION_KEY, SCHEMA_VERSION)


async def compute_major_vectors_mean(db: Any) -> np.ndarray:
    """Mean of every major vector in MongoDB (the source of truth), read-only float32."""
    total = np.zeros(VECTOR_DIM, dtype=np.float64)
    n = 0
    async for doc in db[config.MAJOR_VECTORS_COLLECTION].find({}, {"_id": 0, "vector": 1}):
        vec = np.asarray(doc.get("vector"), dtype=np.float32)
        if vec.shape != (VECTOR_DIM,):
            raise RuntimeError(f"major_vectors document #{n} has a bad 'vector' "
                               f"(shape {vec.shape}, expected ({VECTOR_DIM},))")
        total += vec
        n += 1
    if n == 0:
        raise RuntimeError("major_vectors is empty: cannot compute the mean major vector")
    mean = (total / n).astype(np.float32)
    mean.setflags(write=False)                    # shared by every user
    return mean


async def _sync_index(redis_client: Any, db: Any, index_name: str, prefix: str, schema: tuple,
                      collection: str, rebuild: bool) -> None:
    """
    rebuild=True  : drop the index (documents are kept), re-copy everything, re-create it.
    rebuild=False : re-copy only if Redis holds a different number of documents than MongoDB
                    (e.g. a copy that crashed half-way); create the index if it is missing.
    """
    if rebuild and await _index_exists(redis_client, index_name):
        log.info("Dropping index '%s' (schema changed)", index_name)
        await redis_client.ft(index_name).dropindex(delete_documents=False)

    mongo_count = await db[collection].count_documents({})
    if rebuild or await _count_keys(redis_client, prefix) != mongo_count:
        log.info("Copying collection '%s' to RedisJSON", collection)
        copied = await _copy_collection(redis_client, db, prefix, collection, schema)
        log.info("Copied %d documents from '%s'", copied, collection)

    if not await _index_exists(redis_client, index_name):
        log.info("Creating index '%s'", index_name)
        definition = IndexDefinition(prefix=[prefix], index_type=IndexType.JSON)
        # FT.CREATE back-fills the documents already under the prefix
        await redis_client.ft(index_name).create_index(schema, definition=definition)

    await _check_index_health(redis_client, index_name, mongo_count)


async def _index_exists(redis_client: Any, index_name: str) -> bool:
    try:
        await redis_client.ft(index_name).info()
    except ResponseError as exc:
        msg = str(exc).lower()
        if "unknown index" in msg or "no such index" in msg:
            return False
        raise
    return True


async def _count_keys(redis_client: Any, prefix: str) -> int:
    n = 0
    async for _ in redis_client.scan_iter(match=f"{prefix}*", count=BATCH):
        n += 1
    return n


def _tag_paths(schema: tuple) -> list[tuple[list[str], bool]]:
    """(key path, is_array) of every TagField: "$.relative_majors[*]" -> (["relative_majors"], True)."""
    paths = []
    for field in schema:
        if isinstance(field, TagField):
            path = str(field.name).removeprefix("$.")
            paths.append((path.removesuffix("[*]").split("."), path.endswith("[*]")))
    return paths


def _stringify_tags(doc: dict, tag_paths: list[tuple[list[str], bool]]) -> None:
    """RediSearch rejects a WHOLE document when a TAG path holds a JSON number, so TAG values
    are stored as strings in the Redis copy (MongoDB keeps its types)."""
    for keys, is_array in tag_paths:
        parent = doc
        for key in keys[:-1]:
            parent = parent.get(key) if isinstance(parent, dict) else None
        if not isinstance(parent, dict) or parent.get(keys[-1]) is None:
            continue
        value = parent[keys[-1]]
        if is_array and isinstance(value, list):
            parent[keys[-1]] = [v if isinstance(v, str) or v is None else str(v) for v in value]
        elif not isinstance(value, (str, list, dict)):
            parent[keys[-1]] = str(value)


async def _copy_collection(redis_client: Any, db: Any, prefix: str, collection: str,
                           schema: tuple) -> int:
    """(Over)write every MongoDB document into RedisJSON, then delete the keys under `prefix`
    whose document is gone from MongoDB, so removed documents stop being searchable."""
    tag_paths = _tag_paths(schema)
    pipe = redis_client.pipeline(transaction=False)
    written: set[str] = set()
    count = 0
    async for doc in db[collection].find({}):
        doc["_id"] = str(doc["_id"])               # ObjectId is not JSON-serialisable
        _stringify_tags(doc, tag_paths)
        key = f"{prefix}{doc['_id']}"
        pipe.json().set(key, "$", doc)
        written.add(key)
        count += 1
        if count % BATCH == 0:
            await pipe.execute()
    if count % BATCH:
        await pipe.execute()

    stale = []
    async for key in redis_client.scan_iter(match=f"{prefix}*", count=BATCH):
        if (key.decode() if isinstance(key, bytes) else key) not in written:
            stale.append(key)
    for i in range(0, len(stale), BATCH):
        await redis_client.unlink(*stale[i:i + BATCH])
    if stale:
        log.info("Removed %d stale '%s' keys not in '%s'", len(stale), prefix, collection)
    return count


async def _check_index_health(redis_client: Any, index_name: str, expected: int) -> None:
    """Wait for background indexing, then fail startup if any document was rejected: a
    rejected document is silently missing from every search otherwise."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + INDEXING_TIMEOUT_S
    while True:
        info = await redis_client.ft(index_name).info()
        if str(info.get("indexing", "0")) in ("0", "0.0") or loop.time() > deadline:
            break
        await asyncio.sleep(0.5)

    num_docs = int(info.get("num_docs", 0))
    failures = int(info.get("hash_indexing_failures", 0))
    errors = info.get("Index Errors") or {}
    if failures or num_docs != expected:
        raise RuntimeError(
            f"index '{index_name}' holds {num_docs}/{expected} documents "
            f"({failures} indexing failures; last error: {errors.get('last indexing error')!r} "
            f"on key {errors.get('last indexing error key')!r})")
    log.info("Index '%s' healthy: %d documents", index_name, num_docs)
