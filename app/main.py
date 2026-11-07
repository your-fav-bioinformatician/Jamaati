"""FastAPI entry point: `uvicorn app.main:app`."""
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import articles, catalog, quiz, search
from app import config, deps
from app.redis_setup import compute_major_vectors_mean, prepare_redis
from engine.final_rank import close_pools

logging.basicConfig(level=config.LOG_LEVEL,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                    datefmt="%Y-%m-%d %H:%M:%S")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None]:
    log.info("Starting up: syncing Redis with MongoDB")
    await prepare_redis(deps.redis_client, deps.mongo_db)
    deps.major_vectors_mean = await compute_major_vectors_mean(deps.mongo_db)
    log.info("Startup complete")

    yield

    log.info("Shutting down: closing Postgres, Redis and MongoDB connections")
    await close_pools()
    await deps.redis_client.aclose()
    await deps.mongo_client.close()


app = FastAPI(title="Jaamati API", lifespan=lifespan)

# The frontend (front/) is deployed as its own Railway service, so the browser calls this
# API cross-origin. Origins come from CORS_ORIGINS (see app/config.py).
_cors_origins = (["*"] if "*" in config.CORS_ORIGINS
                 else [*config.CORS_ORIGINS, *config.CORS_DEV_ORIGINS])
app.add_middleware(CORSMiddleware,
                   allow_origins=_cors_origins,
                   allow_credentials=False,   # no cookies; required for "*"
                   allow_methods=["GET", "POST", "OPTIONS"],
                   allow_headers=["Content-Type", "Accept"],
                   max_age=600)               # cache preflights for 10 min
log.info("CORS allowed origins: %s", _cors_origins)

app.include_router(quiz.router)
app.include_router(articles.router)
app.include_router(catalog.router)
app.include_router(search.router)


@app.get("/health", include_in_schema=False)
async def health() -> dict:
    """Liveness check (answers once startup has finished)."""
    return {"status": "ok"}
