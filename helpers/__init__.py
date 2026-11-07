"""Shared helpers, grouped by topic.

    errors        EngineError, fail(), require(): how the engine reports bad state
    ids           id_variants(), as_id_list(): ids that may be int or str
    vectors       to_vector(), normalize(), to_blob(), haversine_km()
    redis_search  RediSearch queries and result parsing
    bilingual     one-language views of the bilingual MongoDB documents
    mongo         JSON-safe documents and aggregation expressions
"""
