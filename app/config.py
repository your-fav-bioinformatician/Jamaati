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

# Browser origins allowed to call the API, comma-separated (e.g. the deployed frontend's URL).
# Empty: no CORS headers, fine when the frontend is served from the same origin or a proxy.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

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
