"""Settings from the environment (a .env file in development) and the names shared across
modules: RediSearch indexes and MongoDB collections."""
import os

from dotenv import load_dotenv

load_dotenv()

MONGO_CONN_STR = os.getenv("MONGO_CONN_STR", "")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "")
REDIS_URL = os.getenv("REDIS_URL", "")
PG_CONN_STR = os.getenv("PG_CONN_STR", "")
PG_DB_NAME = os.getenv("PG_DB_NAME") or None   # None: use the database named in PG_CONN_STR


def _origin(value: str) -> str:
    """An origin as browsers send it: scheme://host[:port], no trailing slash.
    A bare host (e.g. a Railway domain reference) gets https://."""
    value = value.strip().rstrip("/")
    if value != "*" and "://" not in value:
        value = f"https://{value}"
    return value


# Browser origins allowed to call the API, comma-separated: the deployed frontend's URL,
# e.g. https://jamaati-front.up.railway.app. Unset or "*": any origin (the API uses no
# cookies or auth headers, so this exposes nothing a non-browser client couldn't reach).
# The Vite dev and preview servers are always allowed.
CORS_ORIGINS = [_origin(o) for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()] or ["*"]
CORS_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173",
                    "http://localhost:4173", "http://127.0.0.1:4173"]

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Quiz sessions live in this process's memory and expire this long after their last use.
SESSION_TTL_SECONDS = 3600

# RediSearch indexes
MBTI_INDEX = "idx:mbti"
CONCEPT_INDEX = "idx:concept"
MAJOR_INDEX = "idx:major"

# MongoDB collections
USERS_COLLECTION = "users_data"
MBTI_VECTORS_COLLECTION = "mbti_vectors"
CONCEPT_VECTORS_COLLECTION = "concept_vectors"
MAJOR_VECTORS_COLLECTION = "major_vectors"
MAJORS_INFO_COLLECTION = "majors_info"
ARTICLES_COLLECTION = "articles"
CATALOG_COLLECTION = "catalog"
