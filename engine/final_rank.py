"""
final_rank: turn the final user vector into the user's top departments.

  1. IP KNN of the user vector over every major the user is eligible for (hs / gpa / gender,
     the same filter as best_next) -> a pool of at most POOL_K dept_ids with their IP
  2. one Postgres query: each department's university rank, public/private and location
  3. re-rank the pool and keep the best MAX_DEPTS:
        score = IP
              + W_RANK   * rank_score                uni_rank 1 (best) -> 1 ... worst -> 0
              + W_CLOSE  * exp(-km / CLOSE_SCALE_KM)  only if prefer_close and lat / lon are
                                                     set and not (0, 0)
              + W_PUBLIC * (not is_private)          only if income is "low"
  4. one MongoDB query: the majors_info documents of those departments
  5. {"top_depts": [majors_info document without _id, ...]}, best first. A department with
     no majors_info document is skipped.

Close the Postgres pools with close_pools() on shutdown.
"""
import asyncio
import logging
import math
import re
from typing import Any

import asyncpg
from pymongo.errors import PyMongoError
from redis.commands.search.query import Query

from engine.user_vector_generator import build_eligibility_filter
from helpers.errors import fail
from helpers.ids import id_variants
from helpers.redis_search import search, unwrap_field
from helpers.vectors import haversine_km, to_blob, to_vector

log = logging.getLogger(__name__)

MAX_DEPTS = 30                  # departments returned
POOL_K = 200                    # eligible majors fetched by IP, then re-ranked

# Re-ranking weights, in IP units. The IPs of the top eligible majors usually lie within ~0.1
# of each other, so a few hundredths already reorder them; tune on real data.
W_RANK = 0.05                   # uni_rank 1 -> +W_RANK, worst rank -> +0
W_CLOSE = 0.08                  # prefer_close: 0 km -> +W_CLOSE, decaying with distance
CLOSE_SCALE_KM = 100.0          # closeness bonus is 37% at 100 km, 5% at 300 km
W_PUBLIC = 0.05                 # low income: public university -> +W_PUBLIC
LOW_INCOME = "low"

VECTOR_FIELD = "vector"         # the vector's alias in the major index

# Postgres tables: <schema>.departments -> colleges -> universities
PG_SCHEMA = "dbo"
DEPT_COLLEGE_FK = "college_id"
COLLEGE_PK = "college_id"
COLLEGE_UNI_FK = "uni_id"
UNI_PK = "uni_id"
PG_POOL_MIN = 1
PG_POOL_MAX = 10
PG_CONNECT_TIMEOUT = 30.0
PG_COMMAND_TIMEOUT = 35.0

MONGO_DEPT_FIELD = "dept_id"    # majors_info's join key, == departments.dept_id

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _ident(name: str) -> str:
    """Identifiers are interpolated into the SQL text, so only plain names are accepted."""
    if not _IDENT.match(name):
        raise ValueError(f"unsafe SQL identifier: {name!r}")
    return name


def _build_sql() -> str:
    schema = _ident(PG_SCHEMA)
    # ORDER BY array_position keeps the IP order of $1
    return f"""
        SELECT d.dept_id, d.lat, d.lon, u.is_private, u.uni_rank,
               (SELECT max(uni_rank) FROM {schema}.universities) AS worst_uni_rank
        FROM {schema}.departments d
        JOIN {schema}.colleges c      ON c.{_ident(COLLEGE_PK)} = d.{_ident(DEPT_COLLEGE_FK)}
        JOIN {schema}.universities u  ON u.{_ident(UNI_PK)}     = c.{_ident(COLLEGE_UNI_FK)}
        WHERE d.dept_id::text = ANY($1::text[])
        ORDER BY array_position($1::text[], d.dept_id::text)
        LIMIT $2
    """


# ── Postgres pool ────────────────────────────────────────────────────────────
_pools: dict[tuple[str, str | None], asyncpg.Pool] = {}
_pools_lock = asyncio.Lock()


async def get_pool(pg_dsn: str, pg_db: str | None = None) -> asyncpg.Pool:
    """One pool per (dsn, database), created on first use and shared by every call."""
    key = (pg_dsn, pg_db)
    pool = _pools.get(key)
    if pool is not None:
        return pool
    async with _pools_lock:                   # two concurrent first calls must not create two
        pool = _pools.get(key)
        if pool is None:
            extra: dict[str, Any] = {"database": pg_db} if pg_db else {}
            try:
                pool = await asyncpg.create_pool(
                    pg_dsn, min_size=PG_POOL_MIN, max_size=PG_POOL_MAX,
                    command_timeout=PG_COMMAND_TIMEOUT, timeout=PG_CONNECT_TIMEOUT, **extra)
            except (asyncpg.PostgresError, asyncpg.InterfaceError, OSError, TimeoutError) as exc:
                fail(f"postgres connection failed: {exc}")
            _pools[key] = pool
    return pool


async def close_pools() -> None:
    pools = list(_pools.values())
    _pools.clear()
    for pool in pools:
        await pool.close()


# ── step 1: IP ranking over the eligible majors ──────────────────────────────
async def rank_depts(user_vector: Any, users_data: dict, major_vectors: Any,
                     k: int = POOL_K, elig_filter: str | None = None) -> dict[str, float]:
    """{dept_id: IP} for up to k eligible dept_ids, most similar first.
    elig_filter: a ready build_eligibility_filter(users_data), if the caller has one."""
    k = min(k, POOL_K)
    vec = to_vector(user_vector, "user_vector")
    elig = elig_filter or build_eligibility_filter(users_data)
    query = (
        Query(f"({elig})=>[KNN {k} @{VECTOR_FIELD} $vec AS score]")
        .sort_by("score", asc=True)
        .return_field("$.dept_id", as_field="dept_id")
        .return_field("score")
        .paging(0, k)
        .dialect(4)
    )
    docs = await search(major_vectors, query, {"vec": to_blob(vec)})

    ips: dict[str, float] = {}
    for d in docs:
        dept_id = unwrap_field(getattr(d, "dept_id", None))
        if dept_id is None:
            fail(f"major_vectors search result has no dept_id: {d!r}")
        try:
            ip = 1.0 - float(d.score)             # IP distance = 1 - IP
        except (AttributeError, TypeError, ValueError):
            fail(f"major_vectors search result has no usable score: {d!r}")
        ips.setdefault(str(dept_id), ip)      # several majors of one department: keep the best
    return ips


# ── step 2: Postgres lookup ──────────────────────────────────────────────────
async def fetch_departments(dept_ids: list[str], pg_dsn: str,
                            pg_db: str | None = None) -> list[dict]:
    """One row per department (at most POOL_K), in the order of dept_ids."""
    if not dept_ids:
        return []
    pool = await get_pool(pg_dsn, pg_db)
    try:
        rows = await pool.fetch(_build_sql(), dept_ids[:POOL_K], POOL_K,
                                timeout=PG_COMMAND_TIMEOUT)
    except (asyncpg.PostgresError, asyncpg.InterfaceError, OSError, TimeoutError) as exc:
        fail(f"postgres lookup failed: {exc}")
    return [dict(r) for r in rows]


# ── step 3: re-ranking ───────────────────────────────────────────────────────
def _user_location(users_data: dict) -> tuple[float, float] | None:
    """(lat, lon) to favour close departments: only with prefer_close and valid coordinates
    other than the (0, 0) "not given" default."""
    raw_lat, raw_lon = users_data.get("lat"), users_data.get("lon")
    if users_data.get("prefer_close") is not True or raw_lat is None or raw_lon is None:
        return None
    try:
        lat, lon = float(raw_lat), float(raw_lon)
    except (TypeError, ValueError):
        return None
    if (lat == 0 and lon == 0) or not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def _is_low_income(users_data: dict) -> bool:
    income = users_data.get("income")
    return isinstance(income, str) and income.strip().lower() == LOW_INCOME


def _rank_score(rank: Any, worst: Any) -> float:
    """uni_rank mapped to [0, 1]: rank 1 -> 1, the worst rank -> 0, missing -> 0."""
    if rank is None:
        return 0.0
    rank, worst = float(rank), float(worst or rank)
    if worst <= 1:
        return 1.0
    return min(1.0, max(0.0, (worst - rank) / (worst - 1)))


def rerank(rows: list[dict], ips: dict[str, float], users_data: dict,
           k: int = MAX_DEPTS) -> list[dict]:
    """The best k rows by the score in the module docstring; ties keep the IP order."""
    here = _user_location(users_data)
    low_income = _is_low_income(users_data)
    scored = []
    for i, row in enumerate(rows):
        score = ips.get(str(row["dept_id"]), float("-inf"))
        score += W_RANK * _rank_score(row.get("uni_rank"), row.get("worst_uni_rank"))
        lat, lon = row.get("lat"), row.get("lon")
        if here is not None and lat is not None and lon is not None and not (lat == 0 and lon == 0):
            km = haversine_km(here, (float(lat), float(lon)))
            score += W_CLOSE * math.exp(-km / CLOSE_SCALE_KM)
        if low_income and row.get("is_private") is False:
            score += W_PUBLIC
        scored.append((score, -i, row))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [row for _, _, row in scored[:k]]


# ── step 4: MongoDB lookup ───────────────────────────────────────────────────
async def fetch_majors_info(dept_ids: list, majors_info: Any) -> dict[str, dict]:
    """{str(dept_id): majors_info document without _id}. Postgres and MongoDB may store the
    id as different types, so both are matched. With duplicates, the first document wins."""
    if not dept_ids:
        return {}
    wanted = [v for d in dept_ids for v in id_variants(d)]
    try:
        cursor = majors_info.find({MONGO_DEPT_FIELD: {"$in": wanted}}, {"_id": 0})
        docs = await cursor.to_list(length=None)
    except PyMongoError as exc:
        fail(f"mongodb lookup failed: {exc}")
    info: dict[str, dict] = {}
    for doc in docs:
        info.setdefault(str(doc.get(MONGO_DEPT_FIELD)), doc)
    return info


# ── entry point ──────────────────────────────────────────────────────────────
async def final_rank(user_vector: Any, users_data: dict, major_vectors: Any,
                     majors_info: Any, pg_dsn: str, pg_db: str | None = None,
                     elig_filter: str | None = None) -> dict:
    """
    user_vector   : the user's final vector
    users_data    : the user's users_data record: hs / gender / gpa (eligibility) and,
                    optionally, income / prefer_close / lat / lon (re-ranking)
    major_vectors : async RediSearch handle of the major index
    majors_info   : async pymongo collection 'majors_info'
    pg_dsn, pg_db : Postgres connection string and optional database name
    elig_filter   : optional ready build_eligibility_filter(users_data)
    returns       : {"top_depts": [majors_info document, ...]}, best first, at most MAX_DEPTS
    """
    if not isinstance(pg_dsn, str) or not pg_dsn.strip():
        fail("pg_dsn is missing")
    if majors_info is None:
        fail("majors_info is missing")
    ips = await rank_depts(user_vector, users_data, major_vectors, elig_filter=elig_filter)
    rows = rerank(await fetch_departments(list(ips), pg_dsn, pg_db), ips, users_data)
    docs = await fetch_majors_info([r["dept_id"] for r in rows], majors_info)

    top_depts = []
    for row in rows:
        doc = docs.get(str(row["dept_id"]))
        if doc is None:
            log.warning("dept_id %s has no majors_info document; skipped", row["dept_id"])
            continue
        top_depts.append(doc)
    return {"top_depts": top_depts}
