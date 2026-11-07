"""Process-wide clients and state, and the FastAPI dependencies that hand them out."""
import numpy as np
import pymongo
import redis.asyncio

from app import config
from app.session_manager import SessionManager

mongo_client = pymongo.AsyncMongoClient(config.MONGO_CONN_STR)
mongo_db = mongo_client[config.MONGO_DB_NAME]

redis_client = redis.asyncio.Redis.from_url(config.REDIS_URL, socket_timeout=5,
                                            retry_on_timeout=True)

session_manager = SessionManager(ttl_seconds=config.SESSION_TTL_SECONDS)

# Mean of every major vector: the starting point of each user vector. Built once at startup
# (app.main lifespan) and read-only afterwards.
major_vectors_mean: np.ndarray | None = None


async def get_mongo_db():
    return mongo_db


async def get_redis_client():
    return redis_client


def get_session_manager() -> SessionManager:
    return session_manager


def get_pg_settings() -> tuple[str, str | None]:
    """(dsn, database name or None)."""
    return config.PG_CONN_STR, config.PG_DB_NAME
