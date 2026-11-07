"""One-language views of the bilingual MongoDB documents.

Two layouts are stored:
  - `X` English + `X_ar` Arabic   (catalog; majors_info.description / description_ar)
  - `X` Arabic  + `X_en` English  (majors_info.full_name / full_name_en)
Endpoints take `?lang=en|ar` and return one language under the plain field names (localize);
the second layout is first rewritten as the first (normalize_bilingual).
"""
from typing import Annotated, Any, Literal

from fastapi import Query

AR_SUFFIX = "_ar"
EN_SUFFIX = "_en"

Lang = Literal["en", "ar"]
LangQuery = Annotated[Lang, Query(description="Language of the translatable fields")]


def bilingual_projection(fields: tuple[str, ...]) -> dict:
    """A projection of each field with its `_ar` / `_en` twins (missing twins are just absent)."""
    return ({f: 1 for f in fields} | {f + AR_SUFFIX: 1 for f in fields}
            | {f + EN_SUFFIX: 1 for f in fields})


def normalize_bilingual(doc: dict) -> dict:
    """Rewrite every `X` (Arabic) / `X_en` (English) pair as `X` (English) / `X_ar` (Arabic), in
    place. An `X_en` with no `X` simply becomes `X`; an existing `X_ar` is never overwritten."""
    for en_key in [k for k in doc if k.endswith(EN_SUFFIX)]:
        base = en_key.removesuffix(EN_SUFFIX)
        if base in doc and base + AR_SUFFIX not in doc:
            doc[base + AR_SUFFIX] = doc.pop(base)
        doc[base] = doc.pop(en_key)
    return doc


def localize(doc: dict, lang: Lang) -> dict:
    """`doc` in one language: `X` gets the value for `lang` and the `X_ar` / `X_en` twins are
    dropped. Arabic falls back to English when the `_ar` value is missing or empty; an `_ar`
    field with no English twin is kept (under the base name) only for Arabic."""
    doc = normalize_bilingual(dict(doc))
    out: dict[str, Any] = {}
    for key, value in doc.items():
        if key.endswith(AR_SUFFIX):
            base = key.removesuffix(AR_SUFFIX)
            if lang == "ar" and base not in doc:
                out[base] = value
            continue
        if lang == "ar":
            ar_value = doc.get(key + AR_SUFFIX)
            out[key] = ar_value if ar_value not in (None, "", []) else value
        else:
            out[key] = value
    return out
