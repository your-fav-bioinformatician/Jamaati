"""
Index schema needed (JSON):
  major_vectors:
      $.vector AS vector VECTOR ... DISTANCE_METRIC IP
      $.dept_id AS dept_id TAG
      $.eligibility.hs AS elig_hs TAG
      $.eligibility.gpa AS elig_gpa NUMERIC
      $.eligibility.gender AS elig_gender TAG
  concept_vectors:
      $.id AS id TAG
      $.relative_majors[*] AS relative_majors TAG
      $.concept_vector AS concept_vector VECTOR ... DISTANCE_METRIC IP
  mbti_vectors:
      $.mbti AS mbti TAG
      (the vector itself is read from the document body: $.mbti_vector, not indexed)

Concept JSON body must also carry (read from the document, not queried):
  parent_ids : list   (ids of the concepts this one hangs under)
  child_ids  : list
  is_leaf    : bool
  layer      : int    (adjusts the tree moves, see layer_bonus; the quiz starts on layer 1)

Vectors: every stored vector (major, concept, mbti) is already unit length, so the IP of two
of them is their cosine. The user vector is re-normalised after every calculation
(init_user, every answer), so it is unit length too.

Eligibility: the user's eligible dept_ids are computed ONCE, in the starting state, over the
whole major_vectors index, and cached in the session (ELIGIBLE_KEY). Every later answer reuses
that list: a concept is eligible iff one of its relative_majors is in it (checked in Python,
no extra Redis query).

Ranking: candidates are ranked by IP(user_vector, concept_vector). When even the best
candidate's IP is below WEAK_IP, the concept vectors say little about the user, so each
candidate is ranked instead by its closest ELIGIBLE relative major: a KNN of the user vector
over major_vectors, restricted to the candidates' eligible relative majors (see
_rank_by_majors_if_weak). This is also what lets hs / gpa / gender change the pick.

Ending the quiz: a leaf answer or a tree dead end ends it, except that
  - on layer START_LAYER a dead end never ends it: the closest sibling/child is asked
    (siblings of a top-level concept = the other START_LAYER concepts, ids cached at the
    starting state under START_IDS_KEY);
  - while fewer than MIN_QUESTIONS questions were asked, nothing ends it (leaf or dead end,
    on any layer): the closest sibling/child is asked.
The quiz still ends if that fallback has no unasked, eligible sibling/child to offer.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import numpy as np
from pymongo.errors import PyMongoError
from redis.commands.search.query import Query

from helpers.errors import fail, require
from helpers.ids import as_id_list
from helpers.redis_search import (
    doc_json,
    escape_tag,
    ip_from_score,
    plain_query,
    search,
    tag_union,
    unwrap_field,
)
from helpers.vectors import normalize, to_blob, to_vector

if TYPE_CHECKING:
    from app.session_manager import SessionManager

log = logging.getLogger(__name__)

# ── constants ────────────────────────────────────────────────────────────────
W = {1: -1.0, 2: -0.4, 3: 0.0, 4: 0.4, 5: 1.0}
GPA_MARGIN = 3
MAX_CANDIDATES = 1000       # concepts examined by the starting KNN (layer is checked on them)
MAX_MAJORS = 10000          # upper bound on the eligible majors fetched per call
START_LAYER = 1             # the first question is always a concept on this layer
MIN_QUESTIONS = 3           # the quiz never ends before this many questions were asked
# best IP(user, concept) below this -> rank the candidates by their closest eligible relative
# major instead (IP is a cosine in [-1, 1]); tune against real data
WEAK_IP = 0.7
# layer_bonus (all vectors are unit length, so IP is in [-1, 1]); tune against real data
LAYER_STEP = 0.05           # per layer away from the current one
DOWN_PENALTY = 0.15         # extra for going to a lower layer (w <= 0 only)
USER_ID_FIELD = "id"
ELIGIBLE_KEY = "eligible_depts"     # session key: dept_ids cached at the starting state
START_IDS_KEY = "start_layer_ids"   # session key: layer-START_LAYER concept ids (same time)


# ── session helpers (the only place the session manager is touched) ──────────
def _sess_get(session: SessionManager, user_id: Any, key: str) -> Any:
    """Read a required key. SessionManager.get raises ValueError on an expired/unknown
    session and returns the default when the key is absent; both mean "no state"."""
    value = _sess_get_optional(session, user_id, key)
    if value is None:
        fail(f"session has no '{key}' for user '{user_id}' (call init_user first)")
    return value


def _sess_get_optional(session: SessionManager, user_id: Any, key: str) -> Any:
    """Read a key that may be absent (None); the session itself must exist."""
    try:
        return session.get(user_id, key)
    except ValueError as exc:
        fail(f"session error for user '{user_id}': {exc} (call init_user first)")


def _sess_set(session: SessionManager, user_id: Any, key: str, value: Any) -> None:
    """Write a key (ndarrays are copied on the way in by the manager)."""
    try:
        session.set(user_id, key, value)
    except ValueError as exc:
        fail(f"session error for user '{user_id}': {exc}")


def _sess_asked(session: SessionManager, user_id: Any) -> list:
    """A snapshot (copy) of this user's asked ids; the session must exist."""
    try:
        return session.asked_ids(user_id)
    except ValueError as exc:
        fail(f"session error for user '{user_id}': {exc} (call init_user first)")


def _sess_add_asked(session: SessionManager, user_id: Any, question_id: Any) -> None:
    """Record a question as asked (done by the manager, under its lock)."""
    try:
        session.add_asked(user_id, question_id)
    except ValueError as exc:
        fail(f"session error for user '{user_id}': {exc}")


# ── concept helpers ──────────────────────────────────────────────────────────
def _eligible_majors(relative_majors: Any, eligible: set[str]) -> list[str]:
    """The concept's relative_majors that are in the user's cached eligible dept_ids."""
    return [m for m in as_id_list(relative_majors) if m in eligible]


async def _get_concept(concept_vectors: Any, concept_id: Any, with_vector: bool = True) -> dict:
    """Return the concept data for the given concept_id, or fail if not found.
    with_vector=False skips vector validation (used when only the tree links are needed)."""
    docs = await search(concept_vectors,
                   plain_query(f"@id:{{{escape_tag(concept_id)}}}", 1))
    if not docs:
        fail(f"concept '{concept_id}' not found in concept_vectors")
    concept = doc_json(docs[0])
    if with_vector:
        concept["concept_vector"] = to_vector(concept.get("concept_vector"), f"concept '{concept_id}' vector")
    return concept


# ── init_user ────────────────────────────────────────────────────────────────
async def init_user(user_id, users_data, mbti_vectors, session: SessionManager,
                    major_vectors_mean: Any) -> np.ndarray:
    """
    user_id            : the new user's id
    users_data         : async pymongo collection 'users_data'
    mbti_vectors       : async RediSearch handle of the mbti index
    session            : SessionManager
    major_vectors_mean : mean of every major vector (app.deps.major_vectors_mean)
    returns            : user_vector (also stored in the session; asked_ids, the cached
                         eligible dept_ids and the cached layer-1 ids are reset)
    """
    require(user_id, "user_id")
    require(users_data, "users_data collection")
    require(mbti_vectors, "mbti_vectors")
    require(session, "session manager")
    if major_vectors_mean is None:
        fail("the mean major vector is not loaded (startup has not finished)")
    mean = to_vector(major_vectors_mean, "major_vectors_mean")
    user_vector = mean.copy()                        # never mutate the shared mean

    try:
        record = await users_data.find_one(
            {USER_ID_FIELD: str(user_id)},
            {"_id": 0, "mbti": 1, "hs": 1, "gender": 1, "gpa": 1},
        )
    except PyMongoError as exc:
        fail(f"mongodb lookup failed: {exc}")
    if record is None:
        fail(f"no users_data record for user_id '{user_id}'")

    mbti = record.get("mbti")
    if mbti:
        docs = await search(mbti_vectors, plain_query(f"@mbti:{{{escape_tag(mbti)}}}", 1))
        if not docs:
            fail(f"mbti '{mbti}' not found in mbti_vectors")

        mbti_vec = to_vector(doc_json(docs[0]).get("mbti_vector"), f"mbti '{mbti}' mbti_vector")
        user_vector = mean + mbti_vec

    # the mean of unit vectors (and its sum with the mbti vector) is not unit length
    normed = normalize(user_vector)
    if normed is None:
        fail("starting user_vector is zero (MAJOR_VECTORS_MEAN + mbti_vector cancel out)")
    user_vector = normed

    # serialise with any best_next still running for this user (no await between the writes)
    async with session.user_lock(user_id):
        _sess_set(session, user_id, "user_vector", user_vector)
        _sess_set(session, user_id, "asked_ids", [])
        session.delete(user_id, ELIGIBLE_KEY)
        session.delete(user_id, START_IDS_KEY)
    return user_vector


# ── eligibility ──────────────────────────────────────────────────────────────
def build_eligibility_filter(users_data: dict) -> str:
    """
    A major is EXCLUDED if
        eligibility.hs != user.hs
        OR eligibility.gpa > user.gpa + GPA_MARGIN
        OR (eligibility.gender != "both" AND eligibility.gender != user.gender)
    so it is KEPT only if all three conditions above hold.
    """
    gpa = users_data["gpa"]
    hs = users_data["hs"]
    gender = users_data["gender"]

    require(gpa, "users_data.gpa")
    require(hs, "users_data.hs")
    require(gender, "users_data.gender")

    try:
        gpa_max = float(gpa) + GPA_MARGIN
    except (TypeError, ValueError):
        fail("users_data.gpa is not a number")

    hs_clause = f"@elig_hs:{{{escape_tag(hs)}}}"
    gpa_clause = f"@elig_gpa:[-inf {gpa_max}]"
    gender_clause = f"@elig_gender:{{both|{escape_tag(gender)}}}"
    return f"{hs_clause} {gpa_clause} {gender_clause}"   # space = AND


async def eligible_depts(major_vectors: Any, elig: str) -> list[str]:
    """dept_ids (unique, in index order) of every major that passes the eligibility filter."""
    query = (Query(elig).return_field("$.dept_id", as_field="dept_id")
             .paging(0, MAX_MAJORS).dialect(4))
    docs = await search(major_vectors, query)
    if len(docs) >= MAX_MAJORS:
        log.warning("hit MAX_MAJORS=%d; some eligible majors may be missing", MAX_MAJORS)
    depts = []
    for d in docs:
        dept_id = unwrap_field(getattr(d, "dept_id", None))
        if dept_id is not None:
            depts.append(str(dept_id))
    return list(dict.fromkeys(depts))


async def _compute_and_cache_eligible(session: SessionManager, user_id: Any,
                                      users_data: dict, major_vectors: Any) -> list[str]:
    """Query the whole major_vectors index once and cache the eligible dept_ids in the session."""
    depts = await eligible_depts(major_vectors, build_eligibility_filter(users_data))
    _sess_set(session, user_id, ELIGIBLE_KEY, depts)
    if not depts:
        log.warning("no major passes the eligibility filter of user '%s'", user_id)
    return depts


async def _cached_eligible(session: SessionManager, user_id: Any, users_data: dict,
                           major_vectors: Any) -> list[str]:
    """The dept_ids cached at the starting state (recomputed, with a warning, if missing)."""
    depts = _sess_get_optional(session, user_id, ELIGIBLE_KEY)
    if depts is None:
        log.warning("no cached eligible dept_ids for user '%s'; computing them now", user_id)
        return await _compute_and_cache_eligible(session, user_id, users_data, major_vectors)
    return list(depts)


# ── ranking ──────────────────────────────────────────────────────────────────
async def _major_ips(major_vectors: Any, user_vector: np.ndarray,
                     dept_ids: set[str]) -> dict[str, float]:
    """{dept_id: IP(user_vector, major vector)} for the given dept_ids: one KNN over
    major_vectors restricted to them (k = their count, so every one of them is scored)."""
    if not dept_ids:
        return {}
    k = len(dept_ids)
    query = (
        Query(f"(@dept_id:{{{tag_union(sorted(dept_ids))}}})=>[KNN {k} @vector $vec AS score]")
        .sort_by("score", asc=True)
        .return_field("$.dept_id", as_field="dept_id")
        .return_field("score")
        .paging(0, k)
        .dialect(4)
    )
    ips: dict[str, float] = {}
    for d in await search(major_vectors, query, {"vec": to_blob(user_vector)}):
        dept_id = unwrap_field(getattr(d, "dept_id", None))
        if dept_id is not None:
            ips[str(dept_id)] = ip_from_score(d)
    return ips


async def _rank_by_majors_if_weak(major_vectors: Any, user_vector: np.ndarray,
                                  rows: list[dict]) -> bool:
    """
    rows: valid candidates, each with "ip" (IP with its concept vector) and "elig" (its
    eligible relative majors). If even the best "ip" is below WEAK_IP, every row's "ip" is
    replaced by the IP of its closest eligible relative major (KNN over major_vectors) and
    True is returned; otherwise the rows are left untouched (False).
    """
    if not rows or max(r["ip"] for r in rows) >= WEAK_IP:
        return False
    ips = await _major_ips(major_vectors, user_vector, {m for r in rows for m in r["elig"]})
    for r in rows:
        r["ip"] = max((ips[m] for m in r["elig"] if m in ips), default=float("-inf"))
    return True


# ── helpers for best_next ────────────────────────────────────────────────────
def _layer_of(concept: dict) -> int | None:
    """The concept's integer 'layer' field, or None if it is missing / not an integer."""
    raw = concept.get("layer")
    if raw is None or isinstance(raw, bool):
        return None
    try:
        layer = int(raw)
    except (TypeError, ValueError):
        return None
    if isinstance(raw, float) and raw != layer:     # 3.5 is not a layer
        return None
    return layer


def layer_bonus(delta: int, w: float) -> float | None:
    """
    Score adjustment for moving delta = candidate.layer - current.layer (0 is best).
      same layer        :  0
      k layers up       : -LAYER_STEP * k
      k layers down     : -LAYER_STEP * k - DOWN_PENALTY    (w <= 0 only)
      down with w > 0   :  None = not allowed
    """
    if delta < 0:
        if w > 0:
            return None
        return -LAYER_STEP * (-delta) - DOWN_PENALTY
    return -LAYER_STEP * delta


async def _scan_start_layer(concept_vectors: Any, user_vector: np.ndarray) -> list[dict]:
    """
    Every START_LAYER concept among the MAX_CANDIDATES concepts nearest to user_vector, best
    IP first, as {id, ip, leaf, majors}. The layer is not indexed, so a KNN over all concepts
    is run and the layer is checked on its results.
    """
    k = MAX_CANDIDATES
    query = (
        Query(f"*=>[KNN {k} @concept_vector $vec AS score]")
        .sort_by("score", asc=True)                  # IP distance = 1 - IP: smaller is better
        .return_field("$.id", as_field="concept_id")   # not "id": redis-py drops that field (Document.id is the key)
        .return_field("$.is_leaf", as_field="is_leaf")
        .return_field("$.layer", as_field="layer")
        .return_field("$.relative_majors", as_field="relative_majors")
        .return_field("score")
        .paging(0, k)
        .dialect(4)
    )
    docs = await search(concept_vectors, query, {"vec": to_blob(user_vector)})
    if len(docs) >= k:
        log.warning("starting KNN hit MAX_CANDIDATES=%d; layer-%d concepts further away "
                        "were not examined", k, START_LAYER)

    rows = []
    for d in docs:
        if _layer_of({"layer": unwrap_field(getattr(d, "layer", None))}) != START_LAYER:
            continue
        rows.append({"id": unwrap_field(getattr(d, "concept_id", None)),
                     "ip": ip_from_score(d),
                     "leaf": bool(unwrap_field(getattr(d, "is_leaf", None))),
                     "majors": as_id_list(unwrap_field(getattr(d, "relative_majors", None)))})
    return rows


async def pick_start(concept_vectors: Any, major_vectors: Any, user_vector: np.ndarray,
                     eligible: set[str], asked_ids: list) -> tuple[Any | None, list]:
    """
    The first question: among the unasked, non-leaf START_LAYER concepts with at least one
    eligible relative major, the one with the best IP(user_vector, concept_vector), or, when
    that IP is weak, the one with the closest eligible relative major (_rank_by_majors_if_weak).
    returns (chosen id or None, ids of every START_LAYER concept seen). The caller caches the
    ids: they are the "siblings" of a top-level concept in pick_closest.
    """
    if not eligible:
        return None, []
    rows = await _scan_start_layer(concept_vectors, user_vector)
    asked = {str(a) for a in asked_ids}
    valid = []
    for r in rows:
        r["elig"] = _eligible_majors(r["majors"], eligible)
        if not r["leaf"] and str(r["id"]) not in asked and r["elig"]:
            valid.append(r)

    layer_ids = [r["id"] for r in rows]
    if not valid:
        log.warning("no unasked, eligible, non-leaf concept on layer %d", START_LAYER)
        return None, layer_ids
    await _rank_by_majors_if_weak(major_vectors, user_vector, valid)
    return max(valid, key=lambda r: r["ip"])["id"], layer_ids


async def _parents_and_siblings(concept_vectors: Any, question: dict) -> tuple[list, list]:
    """(parent ids, sibling ids) of `question`; siblings = the other children of its parents."""
    qid = question.get("id")
    parents = list(question.get("parent_ids") or [])
    siblings = []
    if parents:
        for doc in await search(concept_vectors, plain_query(
                f"@id:{{{tag_union(parents)}}}", len(parents))):
            siblings.extend(doc_json(doc).get("child_ids") or [])
    siblings = [s for s in dict.fromkeys(siblings) if str(s) != str(qid)]
    return parents, siblings


async def _fetch_concepts(concept_vectors: Any, ids: list) -> list[dict]:
    """The JSON bodies of the given concept ids (a warning names the ids that are missing)."""
    if not ids:
        return []
    docs = await search(concept_vectors, plain_query(f"@id:{{{tag_union(ids)}}}", len(ids)))
    bodies = [doc_json(d) for d in docs]
    found = {str(b.get("id")) for b in bodies}
    missing = [i for i in ids if str(i) not in found]
    if missing:
        log.warning("concept id(s) not found in concept_vectors: %s", missing)
    return bodies


def _drop_asked(ids: list, asked_ids: list) -> list:
    """ids without duplicates and without the already asked ones."""
    asked = {str(a) for a in asked_ids}
    return [i for i in dict.fromkeys(ids) if str(i) not in asked]


async def tree_candidates(concept_vectors: Any, question: dict, w: float,
                          asked_ids: list) -> list:
    """
    Unasked ids the tree allows after answering `question` (which is not a leaf):
      w >  0 : its children
      w <= 0 : its parents and its siblings (the other children of its parents)
    """
    if w > 0:
        ids = list(question.get("child_ids") or [])
    else:
        parents, siblings = await _parents_and_siblings(concept_vectors, question)
        ids = parents + siblings
    return _drop_asked(ids, asked_ids)


async def pick_tree(concept_vectors: Any, major_vectors: Any, user_vector: np.ndarray,
                    eligible: set[str], candidate_ids: list, current_layer: int,
                    w: float) -> Any | None:
    """
    The tree candidate with the best  IP + layer_bonus, where IP is IP(user_vector,
    concept_vector), or, when the best of those is weak, the IP of the candidate's closest
    eligible relative major (_rank_by_majors_if_weak). Only candidates with at least one
    relative major in the cached eligible list are considered (checked in Python). The layer
    is read from each candidate's JSON body.
    """
    valid = []
    for c in await _fetch_concepts(concept_vectors, candidate_ids):
        cid = c.get("id")
        elig = _eligible_majors(c.get("relative_majors"), eligible)
        layer = _layer_of(c)
        if not elig:
            continue
        if layer is None:
            log.warning("concept '%s' has no valid integer 'layer'; skipped", cid)
            continue
        bonus = layer_bonus(layer - current_layer, w)
        if bonus is None:
            continue
        vec = to_vector(c.get("concept_vector"), f"concept '{cid}' vector")
        valid.append({"id": cid, "elig": elig, "bonus": bonus,
                      "ip": float(np.dot(user_vector, vec))})
    if not valid:
        return None
    await _rank_by_majors_if_weak(major_vectors, user_vector, valid)
    return max(valid, key=lambda r: r["ip"] + r["bonus"])["id"]


async def pick_closest(concept_vectors: Any, major_vectors: Any, user_vector: np.ndarray,
                       eligible: set[str], question: dict, asked_ids: list,
                       start_layer_ids: list) -> Any | None:
    """
    Fallback used instead of ending the quiz (see best_next): the unasked, eligible sibling
    or child of `question` closest to the user vector -- by IP(user_vector, concept_vector),
    or, when that is weak, by its closest eligible relative major (_rank_by_majors_if_weak);
    no layer bonus and no direction rule.
      children : its child_ids
      siblings : the other children of its parents; a concept without parents (the top of
                 the tree, i.e. layer START_LAYER) has the other START_LAYER concepts as
                 siblings (start_layer_ids, cached at the starting state)
    """
    qid = question.get("id")
    children = list(question.get("child_ids") or [])
    parents, siblings = await _parents_and_siblings(concept_vectors, question)
    if not parents:
        siblings = [i for i in start_layer_ids if str(i) != str(qid)]

    valid = []
    for c in await _fetch_concepts(concept_vectors, _drop_asked(siblings + children, asked_ids)):
        elig = _eligible_majors(c.get("relative_majors"), eligible)
        if not elig:
            continue
        vec = to_vector(c.get("concept_vector"), f"concept '{c.get('id')}' vector")
        valid.append({"id": c.get("id"), "elig": elig, "ip": float(np.dot(user_vector, vec))})
    if not valid:
        return None
    await _rank_by_majors_if_weak(major_vectors, user_vector, valid)
    return max(valid, key=lambda r: r["ip"])["id"]


def _apply_answer(user_vector: np.ndarray, q_vec: np.ndarray, w: float) -> np.ndarray:
    """
    The user vector after an answer of weight w on a concept with (unit) vector q_vec,
    re-normalised.
      w > 0 : u + w q                       (pull towards the concept)
      w < 0 : u + w max(u.q, 0) q           (w = -1 removes the concept's direction entirely)
      w = 0 : unchanged
    If the update cancels the vector out completely, the previous vector is kept.
    """
    if w > 0:
        updated = user_vector + w * q_vec
    elif w < 0:
        updated = user_vector + w * max(float(np.dot(user_vector, q_vec)), 0.0) * q_vec
    else:
        return user_vector
    normed = normalize(updated)
    if normed is None:
        log.warning("answer cancelled the user vector out; keeping the previous one")
        return user_vector
    return normed


# ── best_next ────────────────────────────────────────────────────────────────
async def best_next(last_answer, question_id, users_data, concept_vectors, major_vectors,
              session: SessionManager) -> Any | None:
    """
    last_answer        : None = missing (error), "" = starting state, 1..5 = answer
    question_id        : id of the concept that was just answered
    users_data         : mongodb record (dict) with id, hs, gender, gpa (already fetched)
    concept_vectors    : async redis-py search handle
    major_vectors      : async redis-py search handle
    session            : SessionManager; user_vector, asked_ids, the eligible dept_ids and the
                         layer-START_LAYER concept ids are read from and written back to it
                         (keyed by users_data["id"]). Calls for the same user are serialised
                         with session.user_lock().
    returns            : next concept id, or None = THE QUIZ IS OVER (the API runs final_rank)
    flow (w = weight of the answer: 1:-1, 2:-0.4, 3:0, 4:0.4, 5:1; n = questions asked so far,
          the one just answered included)
      start            -> eligible dept_ids and the layer-1 concept ids are computed once and
                          cached in the session; then the best non-leaf layer-1 eligible
                          concept (pick_start)
      answered a leaf  -> the vector is updated; n >= MIN_QUESTIONS: None (the quiz ends);
                          n <  MIN_QUESTIONS: the closest sibling/child (pick_closest)
      otherwise        -> candidates from the tree (w > 0: children; w <= 0: parents and
                          siblings), scored IP + layer_bonus (pick_tree). If none is valid:
                            on layer START_LAYER, or while n < MIN_QUESTIONS
                                    -> the closest sibling/child (pick_closest)
                            else    -> None (the quiz ends)
      the quiz also ends (None) when the closest sibling/child fallback finds nothing.
      Every pick ranks by the concept vectors, or by the candidates' closest eligible relative
      major when those are weak (WEAK_IP). Only concepts related to an eligible (cached) major
      are asked.
    """
    if last_answer is None:
        fail("last_answer is missing")

    require(users_data, "users_data record")
    require(concept_vectors, "concept_vectors index")
    require(major_vectors, "major_vectors index")
    require(session, "session manager")
    user_id = require(users_data.get(USER_ID_FIELD), f"users_data.{USER_ID_FIELD}")

    # one request at a time per user: the body reads session state, awaits Redis/Mongo and
    # writes the state back, so concurrent calls for the same user must not interleave
    async with session.user_lock(user_id):
        return await _best_next_locked(last_answer, question_id, users_data, user_id,
                                       concept_vectors, major_vectors, session)


async def _cached_start_layer_ids(session: SessionManager, user_id: Any,
                                  concept_vectors: Any, user_vector: np.ndarray) -> list:
    """The layer-START_LAYER concept ids cached at the starting state (rescanned, with a
    warning, if missing)."""
    ids = _sess_get_optional(session, user_id, START_IDS_KEY)
    if ids is None:
        log.warning("no cached layer-%d concept ids for user '%s'; scanning again",
                        START_LAYER, user_id)
        ids = [r["id"] for r in await _scan_start_layer(concept_vectors, user_vector)]
        _sess_set(session, user_id, START_IDS_KEY, ids)
    return list(ids)


async def _best_next_locked(last_answer, question_id, users_data, user_id,
                            concept_vectors, major_vectors,
                            session: SessionManager) -> Any | None:
    """best_next's body; the caller holds session.user_lock(user_id)."""
    # session state (init_user must have run, and the session must not be expired)
    user_vector = to_vector(_sess_get(session, user_id, "user_vector"), "user_vector")
    asked_snapshot = _sess_asked(session, user_id)   # copy; record questions with _sess_add_asked

    # ── starting state ──
    if last_answer == "":                            # the quiz always starts on layer START_LAYER
        depts = await _compute_and_cache_eligible(session, user_id, users_data, major_vectors)
        chosen, start_ids = await pick_start(concept_vectors, major_vectors, user_vector,
                                             set(depts), asked_snapshot)
        _sess_set(session, user_id, START_IDS_KEY, start_ids)
        if chosen is not None:
            _sess_add_asked(session, user_id, chosen)
        return chosen

    # ── answered state ──
    try:
        answer = int(last_answer)
    except (TypeError, ValueError):
        fail(f"invalid last_answer: {last_answer!r}")
    if answer not in W:
        fail(f"invalid last_answer: {last_answer!r} (expected 1-5)")

    require(question_id, "question_id")
    w = W[answer]
    q = await _get_concept(concept_vectors, question_id)
    is_leaf = bool(q.get("is_leaf"))

    # check the answered question's layer (from its JSON body) before the user vector is
    # touched, so a missing layer fails without leaving a half-applied answer behind
    current_layer = None
    if not is_leaf:
        current_layer = _layer_of(q)
        if current_layer is None:
            fail(f"concept '{question_id}' has no valid integer 'layer'")

    user_vector = _apply_answer(user_vector, q["concept_vector"], w)
    _sess_set(session, user_id, "user_vector", user_vector)

    below_min = len(asked_snapshot) < MIN_QUESTIONS  # asked_snapshot includes this question
    if is_leaf and not below_min:                    # a leaf ends the quiz (after MIN_QUESTIONS)
        return None

    eligible = set(await _cached_eligible(session, user_id, users_data, major_vectors))

    async def closest() -> Any | None:
        start_ids = ([] if q.get("parent_ids") else
                     await _cached_start_layer_ids(session, user_id, concept_vectors, user_vector))
        return await pick_closest(concept_vectors, major_vectors, user_vector, eligible, q,
                                  asked_snapshot, start_ids)

    if is_leaf:                                      # leaf before MIN_QUESTIONS: keep going
        chosen = await closest()
    else:
        candidates = await tree_candidates(concept_vectors, q, w, asked_snapshot)
        assert current_layer is not None             # set above for every non-leaf
        chosen = await pick_tree(concept_vectors, major_vectors, user_vector, eligible,
                                 candidates, current_layer, w)
        if chosen is None:                           # dead end on a non-leaf
            if current_layer != START_LAYER and not below_min:
                return None
            chosen = await closest()                 # layer-1 rule / MIN_QUESTIONS rule

    if chosen is not None:
        _sess_add_asked(session, user_id, chosen)
    return chosen
