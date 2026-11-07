"""
Catalog of careers. Translatable fields hold English in `X` and Arabic in `X_ar` (name,
description, stability, branch, skills_set, workplaces); the others (salaries, mbti_types,
related_majors) are language-neutral.

Every endpoint takes `?lang=en|ar` (default en) and returns one language under the plain
field names.
"""
from fastapi import APIRouter, Depends, HTTPException
from pymongo.asynchronous.database import AsyncDatabase

from app import config, deps
from app.models import BranchRequest, SearchRequest
from helpers.bilingual import Lang, LangQuery, bilingual_projection, localize
from helpers.mongo import text_match_expr, to_json

router = APIRouter(prefix="/catalog")

TITLE_FIELDS = ("name", "stability", "salary", "branch")


def _render(doc: dict, lang: Lang) -> dict:
    return to_json(localize(doc, lang))


def _catalog(db: AsyncDatabase):
    return db[config.CATALOG_COLLECTION]


@router.get("/titles")
async def get_titles(lang: LangQuery = "en",
                     db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list[dict]:
    """name / stability / salary / branch of every career."""
    cursor = _catalog(db).find({}, bilingual_projection(TITLE_FIELDS))
    return [_render(doc, lang) async for doc in cursor]


@router.get("/branches")
async def get_branches(lang: LangQuery = "en",
                       db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list:
    """The distinct branch names, sorted. A branch with no `branch_ar` on any of its docs
    falls back to the English name."""
    cursor = await _catalog(db).aggregate([
        {"$match": {"branch": {"$ne": None}}},
        {"$group": {"_id": "$branch", "branch_ar": {"$max": "$branch_ar"}}},
    ])
    names = {localize({"branch": g["_id"], "branch_ar": g.get("branch_ar")}, lang)["branch"]
             async for g in cursor}
    return sorted(names)


@router.post("/search")
async def search_docs(req: SearchRequest, lang: LangQuery = "en",
                      db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list[dict]:
    """Careers where any query word appears in any text field. Both languages are searched
    whatever `lang` is; only the returned fields are localized."""
    expr = text_match_expr(req.query)
    if expr is None:
        return []
    cursor = await _catalog(db).aggregate([{"$match": {"$expr": expr}}])
    return [_render(doc, lang) async for doc in cursor]


@router.post("/branch")
async def pick_branch(req: BranchRequest, lang: LangQuery = "en",
                      db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list[dict]:
    """Every career of one branch, named in either language."""
    cursor = _catalog(db).find({"$or": [{"branch": req.branch}, {"branch_ar": req.branch}]})
    return [_render(doc, lang) async for doc in cursor]


# keep last: /{doc_id} would otherwise shadow /titles and /branches
@router.get("/{doc_id}")
async def pick_doc(doc_id: int, lang: LangQuery = "en",
                   db: AsyncDatabase = Depends(deps.get_mongo_db)) -> dict:
    """Every field of one career."""
    doc = await _catalog(db).find_one({"_id": doc_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Doc not found")
    return _render(doc, lang)
