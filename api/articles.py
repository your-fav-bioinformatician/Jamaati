"""
Articles, one language per request (`?lang=en|ar`, default en).

Two storage layouts give the same response:
  - one document per language, tagged with `lang` (`en-01-...` / `ar-01-...`): only the
    documents in the requested language are returned;
  - one bilingual document with `X` / `X_ar` fields and no `lang`, collapsed with localize.
"""
from fastapi import APIRouter, Depends
from pymongo.asynchronous.database import AsyncDatabase

from app import config, deps
from helpers.bilingual import Lang, LangQuery, bilingual_projection, localize

router = APIRouter()

ARTICLE_FIELDS = ("title", "body", "related_articles")


def _lang_filter(lang: Lang) -> dict:
    """Documents written in `lang`, plus untagged bilingual ones."""
    return {"$or": [{"lang": lang}, {"lang": {"$exists": False}}]}


@router.get("/articles")
async def get_articles(lang: LangQuery = "en",
                       db: AsyncDatabase = Depends(deps.get_mongo_db)) -> list[dict]:
    """Every article in `lang`."""
    cursor = db[config.ARTICLES_COLLECTION].find(_lang_filter(lang),
                                                 bilingual_projection(ARTICLE_FIELDS))
    articles = []
    async for raw in cursor:
        doc = localize(raw, lang)
        articles.append({
            "id": str(doc["_id"]),
            "title": doc.get("title"),
            "lang": lang,
            "body": doc.get("body"),
            "related_articles": [str(i) for i in doc.get("related_articles") or []],
        })
    return articles
