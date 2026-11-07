"""
Majors (departments), from the `majors_info` collection. full_name is Arabic with
full_name_en English; description is English with description_ar Arabic. The other fields
(dept_id, gpa, hs, gender, lat, lon, web, is_private, tags, mbti) are language-neutral.

Every endpoint takes `?lang=en|ar` (default en) and returns one language under the plain field
names. Documents are identified by their dept_id, returned as `id`.
"""
from fastapi import APIRouter, Depends, HTTPException
from pymongo.asynchronous.database import AsyncDatabase

from app import config, deps
from app.models import MajorSearchRequest
from helpers.bilingual import Lang, LangQuery, bilingual_projection, localize
from helpers.mongo import distance_km_expr, text_match_expr, to_json

router = APIRouter(prefix="/majors")

TITLE_PROJECTION = {"_id": 0, "dept_id": 1, "hs": 1, "gpa": 1} | bilingual_projection(("full_name",))
MAX_DISTANCE_KM = 100


def _render(doc: dict, lang: Lang) -> dict:
    """One language, JSON-safe; Mongo's ObjectId is dropped and dept_id becomes `id`."""
    doc.pop("_id", None)
    doc["_id"] = doc.pop("dept_id", None)
    return to_json(localize(doc, lang))


def _majors(db: AsyncDatabase):
    return db[config.MAJORS_INFO_COLLECTION]


@router.post("/search")
async def search(req: MajorSearchRequest, lang: LangQuery = "en",
                 db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list[dict]:
    """The majors matching every given filter. With lat + lon, only those within
    MAX_DISTANCE_KM, closest first, each with a distance_km. The text query matches both
    languages whatever `lang` is."""
    match: dict = {}
    if req.query and (expr := text_match_expr(req.query)) is not None:
        match["$expr"] = expr
    # equality also matches a document whose field is an array containing the value
    if req.tags:
        match["tags"] = {"$in": req.tags}
    if req.mbti:
        match["mbti"] = req.mbti
    if req.hs:
        match["hs"] = req.hs
    if req.gpa is not None:
        match["gpa"] = {"$lte": req.gpa}

    pipeline: list[dict] = [{"$match": match}]
    if req.lat is not None and req.lon is not None:
        # documents without numeric coordinates would sort as the closest
        match["lat"] = {"$type": "number"}
        match["lon"] = {"$type": "number"}
        pipeline += [
            {"$addFields": {"distance_km": distance_km_expr(req.lat, req.lon)}},
            {"$match": {"distance_km": {"$lte": MAX_DISTANCE_KM}}},
            {"$sort": {"distance_km": 1}},
        ]

    cursor = await _majors(db).aggregate(pipeline)
    return [_render(doc, lang) async for doc in cursor]


@router.get("/titles")
async def get_titles(lang: LangQuery = "en",
                     db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list[dict]:
    """id / full_name / hs / gpa of every major."""
    cursor = _majors(db).find({}, TITLE_PROJECTION)
    return [_render(doc, lang) async for doc in cursor]


# keep last: /{dept_id} would otherwise shadow /titles
@router.get("/{dept_id}")
async def pick_doc(dept_id: int, lang: LangQuery = "en",
                   db: AsyncDatabase = Depends(deps.get_mongo_db)) -> dict:
    """Every field of one major."""
    doc = await _majors(db).find_one({"dept_id": dept_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Major not found")
    return _render(doc, lang)
