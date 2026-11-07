"""The adaptive quiz: /init opens a session, /next_q serves questions (and the final ranking
once the quiz is over), /answer records an answer.

Sessions live in memory (app.deps.session_manager) for SESSION_TTL_SECONDS after their last
use; a call on an expired or unknown session answers 410 Gone.
"""
import datetime as dt
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import PyMongoError
from redis.asyncio import Redis

from app import config, deps
from app.models import (
    AnswerRequest,
    AnswerResponse,
    FinalRankResponse,
    InitResponse,
    NextQuestionResponse,
    RequestValidationErrorResponse,
    SessionGoneResponse,
    UserInfoRequest,
)
from app.session_manager import SessionManager
from engine.final_rank import final_rank
from engine.user_vector_generator import USER_ID_FIELD, best_next, init_user
from helpers.errors import run_engine
from helpers.ids import id_variants, is_blank_id

log = logging.getLogger(__name__)
router = APIRouter()

# session keys
CURRENT_Q = "current_q"     # the question served and waiting for an answer
QUIZ_DONE = "quiz_done"     # set once best_next has no next question: /next_q then only
                            # returns the final ranking, it never starts a new round

REQUIRED_FOR_QUIZ = ("hs", "gender", "gpa")   # the eligibility filter is built from them

SESSION_GONE_DESCRIPTION = (
    "Session gone: the quiz session for this user_id expired (1 h TTL), was lost on a "
    "server restart, or was never initialised. Call /init again and use the new user_id."
)
INIT_422_DESCRIPTION = (
    "Unprocessable content: a field the quiz needs (hs, gender, gpa) is missing or null "
    '-> {"error", "missing"}; or a field has the wrong type -> FastAPI\'s {"detail": [...]}.'
)
ANSWER_422_DESCRIPTION = (
    "Unprocessable content: answer is null, not convertible to an integer (e.g. true, 2.5, "
    '"abc"), or outside 1..5 -> {"prev", "answer", "error"}; or user_id / question_id is '
    'missing or has the wrong type -> FastAPI\'s {"detail": [...]}.'
)


# ── endpoints ────────────────────────────────────────────────────────────────
@router.post("/init", response_model=InitResponse,
             responses={422: {"model": dict[str, Any] | RequestValidationErrorResponse,
                              "description": INIT_422_DESCRIPTION}})
async def initialize_user(
        req: UserInfoRequest,
        db: AsyncDatabase = Depends(deps.get_mongo_db),
        redis_client: Redis = Depends(deps.get_redis_client),
        session: SessionManager = Depends(deps.get_session_manager),
):
    """Store the user's answers and open their quiz session (starting user_vector, no
    questions asked yet). 422 {"error", "missing"} when hs, gender or gpa is missing."""
    demographic_data = req.model_dump(exclude_none=True)
    missing = [f for f in REQUIRED_FOR_QUIZ if f not in demographic_data]
    if missing:
        return JSONResponse(status_code=422, content={
            "error": f"missing fields required for the quiz: {', '.join(missing)}",
            "missing": missing,
        })

    user_id = str(uuid.uuid4())
    created_at = dt.datetime.now(dt.UTC)
    users = db[config.USERS_COLLECTION]
    try:
        await users.insert_one({**demographic_data, USER_ID_FIELD: user_id, "created_at": created_at})
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"could not save user: {exc}") from exc

    await run_engine(
        init_user(user_id, users, redis_client.ft(config.MBTI_INDEX), session,
                  deps.major_vectors_mean),
        "init_user",
    )
    return {"user_id": user_id, "created_at": created_at.isoformat()}


@router.get("/next_q", response_model=NextQuestionResponse | FinalRankResponse,
            responses={410: {"model": SessionGoneResponse,
                             "description": SESSION_GONE_DESCRIPTION}})
async def get_next_question(
        user_id: str,
        db: AsyncDatabase = Depends(deps.get_mongo_db),
        redis_client: Redis = Depends(deps.get_redis_client),
        session: SessionManager = Depends(deps.get_session_manager),
):
    """
    The question to answer now: the one /answer picked (or served earlier and still
    unanswered), else the first question. Once the quiz is over (a leaf was answered,
    best_next found nothing, or a question id is missing from concept_vectors) the final
    ranking is returned instead: {"top_depts": [...]}.
    """
    if not session.has(user_id, "user_vector"):
        return _session_gone(user_id)

    if session.get(user_id, QUIZ_DONE):
        return await _final_results(db, redis_client, session, user_id)

    record = None
    chosen = session.get(user_id, CURRENT_Q)
    if is_blank_id(chosen):
        record = await _get_user_record(db, user_id)
        chosen = await _call_best_next("", None, record, redis_client, session)
        if is_blank_id(chosen):
            return await _final_results(db, redis_client, session, user_id, record)
        session.set(user_id, CURRENT_Q, chosen)

    try:
        document = await db[config.CONCEPT_VECTORS_COLLECTION].find_one(
            {"id": {"$in": id_variants(chosen)}}, {"_id": 0, "id": 1, "question": 1}
        )
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"mongodb lookup failed: {exc}") from exc
    if document is None or is_blank_id(document.get("id")) or document.get("question") is None:
        log.warning("question id %r not found in concept_vectors; ending the quiz", chosen)
        return await _final_results(db, redis_client, session, user_id, record)

    return {"id": int(document["id"]), "question": str(document["question"])}


@router.post("/answer", response_model=AnswerResponse,
             responses={410: {"model": AnswerResponse,
                              "description": SESSION_GONE_DESCRIPTION},
                        422: {"model": AnswerResponse | RequestValidationErrorResponse,
                              "description": ANSWER_422_DESCRIPTION}})
async def process_answer(
        req: AnswerRequest,
        db: AsyncDatabase = Depends(deps.get_mongo_db),
        redis_client: Redis = Depends(deps.get_redis_client),
        session: SessionManager = Depends(deps.get_session_manager),
):
    """Record a 1..5 answer to the waiting question and pick the next one for /next_q."""
    def error(status: int, message: str) -> JSONResponse:
        return JSONResponse(status_code=status,
                            content={"prev": req.question_id, "answer": req.answer, "error": message})

    answer, problem = _parse_answer(req.answer)
    if problem is not None:
        return error(422, problem)

    if not session.has(req.user_id, "user_vector"):
        return error(410, _session_gone_message(req.user_id))

    current = session.get(req.user_id, CURRENT_Q)
    if current is None or str(current) != str(req.question_id):
        return error(409, f"question {req.question_id} is not the question waiting for an "
                          f"answer (expected {current}); call /next_q first")

    record = await _get_user_record(db, req.user_id)
    try:
        chosen = await _call_best_next(answer, req.question_id, record, redis_client, session)
    except HTTPException as exc:
        return error(exc.status_code, str(exc.detail))

    if is_blank_id(chosen):                       # no next question: the quiz is over
        session.delete(req.user_id, CURRENT_Q)
        session.set(req.user_id, QUIZ_DONE, True)
    else:
        session.set(req.user_id, CURRENT_Q, chosen)

    return {"prev": req.question_id, "answer": answer, "error": None}


# ── helpers ──────────────────────────────────────────────────────────────────
def _session_gone_message(user_id: str) -> str:
    return (f"session for user_id '{user_id}' expired or was never initialised "
            "(call /init again)")


def _session_gone(user_id: str) -> JSONResponse:
    """410 Gone: {"user_id", "error"} (SessionGoneResponse)."""
    return JSONResponse(status_code=410,
                        content={"user_id": user_id, "error": _session_gone_message(user_id)})


async def _get_user_record(db: AsyncDatabase, user_id: str) -> dict:
    """The user's record: what best_next needs (id, hs, gender, gpa) and what final_rank
    re-ranks with (income, prefer_close, lat, lon). 404 if unknown."""
    try:
        record = await db[config.USERS_COLLECTION].find_one(
            {USER_ID_FIELD: user_id},
            {"_id": 0, USER_ID_FIELD: 1, "hs": 1, "gender": 1, "gpa": 1,
             "income": 1, "prefer_close": 1, "lat": 1, "lon": 1},
        )
    except PyMongoError as exc:
        raise HTTPException(status_code=500, detail=f"mongodb lookup failed: {exc}") from exc
    if record is None:
        raise HTTPException(status_code=404, detail=f"unknown user_id '{user_id}' (call /init first)")
    return record


async def _call_best_next(last_answer: Any, question_id: Any, record: dict,
                          redis_client: Redis, session: SessionManager) -> Any | None:
    return await run_engine(
        best_next(
            last_answer=last_answer,
            question_id=question_id,
            users_data=record,
            concept_vectors=redis_client.ft(config.CONCEPT_INDEX),
            major_vectors=redis_client.ft(config.MAJOR_INDEX),
            session=session,
        ),
        "best_next",
    )


async def _final_results(db: AsyncDatabase, redis_client: Redis, session: SessionManager,
                         user_id: str, record: dict | None = None) -> dict | JSONResponse:
    """The quiz is over: rank the user's top departments from their final user_vector."""
    session.delete(user_id, CURRENT_Q)
    if record is None:
        record = await _get_user_record(db, user_id)
    user_vector = session.get(user_id, "user_vector")
    if user_vector is None:                       # expired since the caller checked
        return _session_gone(user_id)
    pg_dsn, pg_db = deps.get_pg_settings()
    result = await run_engine(
        final_rank(
            user_vector=user_vector,
            users_data=record,
            major_vectors=redis_client.ft(config.MAJOR_INDEX),
            majors_info=db[config.MAJORS_INFO_COLLECTION],
            pg_dsn=pg_dsn,
            pg_db=pg_db,
        ),
        "final_rank",
    )
    log.debug("final ranking for %s (hs=%r gpa=%r gender=%r): %s", user_id, record.get("hs"),
              record.get("gpa"), record.get("gender"),
              [d.get("dept_id") for d in result.get("top_depts", [])])
    return result


def _parse_answer(value: Any) -> tuple[int | None, str | None]:
    """(answer, None), or (None, error) unless `value` is an integer in 1..5.
    Accepts 4, "4", " 4 ", 4.0 and "4.0"; rejects null, booleans, 2.5, "abc", lists, ..."""
    if value is None:
        return None, "answer is missing (null); expected an integer between 1 and 5"
    bad_type = (f"answer must be an integer between 1 and 5, "
                f"got {type(value).__name__} {value!r}")
    if isinstance(value, bool):                   # bool is an int subclass
        return None, bad_type
    if isinstance(value, int):
        number = value
    elif isinstance(value, (float, str)):
        try:
            as_float = float(value)
        except ValueError:
            return None, bad_type
        if not as_float.is_integer():             # 2.5, nan, inf
            return None, bad_type
        number = int(as_float)
    else:
        return None, bad_type
    if not 1 <= number <= 5:
        return None, f"answer must be between 1 and 5 (inclusive), got {value!r}"
    return number, None
