// Client for the FastAPI quiz endpoints in api/quiz.py.
//
// In development, Vite proxies /api to the backend (see vite.config.js), so
// the backend needs no CORS setup. For a deployed build, set VITE_API_BASE
// to the backend URL, or serve both behind one origin.

const BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');

// /init and the final ranking can be slow (eligibility filtering, ranking
// over every major); answering is quick.
const SLOW_MS = 120_000;
const FAST_MS = 30_000;

export class ApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** 410 Gone: the backend's 1 h quiz session expired or was lost. */
export class SessionGoneError extends ApiError {
  constructor(body) {
    super('session gone', 410, body);
    this.name = 'SessionGoneError';
  }
}

async function request(path, { method = 'GET', body, timeoutMs = FAST_MS, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (signal?.aborted) throw err; // the caller cancelled: not an error to show
    throw new ApiError(err?.name === 'TimeoutError' ? 'timeout' : 'network error');
  }

  const data = await res.json().catch(() => null);
  if (res.status === 410) throw new SessionGoneError(data);
  if (!res.ok) {
    const detail = data?.error ?? (typeof data?.detail === 'string' ? data.detail : null);
    throw new ApiError(detail ?? `HTTP ${res.status}`, res.status, data);
  }
  return data;
}

/** POST /init: stores the intake answers and opens a quiz session. → { user_id, created_at } */
export const initQuiz = (payload) => request('/init', { method: 'POST', body: payload, timeoutMs: SLOW_MS });

/**
 * GET /next_q: the question to answer now → { id, question },
 * or, once the quiz is over, the final ranking → { top_depts: [...] }.
 */
export const nextQuestion = (userId) =>
  request(`/next_q?user_id=${encodeURIComponent(userId)}`, { timeoutMs: SLOW_MS });

/** POST /answer: an integer 1..5 answer (see ANSWERS in i18n/options.js) to the question /next_q served. */
export function submitAnswer(userId, questionId, answer) {
  if (!Number.isInteger(questionId) || !Number.isInteger(answer) || answer < 1 || answer > 5) {
    return Promise.reject(new ApiError(`invalid answer ${answer} for question ${questionId}`));
  }
  return request('/answer', { method: 'POST', body: { user_id: userId, question_id: questionId, answer } });
}

/** True if a /next_q response is the final ranking rather than a question. */
export const isFinalRanking = (data) => Array.isArray(data?.top_depts);

// Shares one in-flight request per key, so a double click, a remount, or
// React StrictMode's double effect never sends the same call twice (which
// for /init would create two backend users).
const inflight = new Map();
export function once(key, run) {
  if (!inflight.has(key)) {
    inflight.set(key, run().finally(() => inflight.delete(key)));
  }
  return inflight.get(key);
}

// ── articles, catalog, majors (api/articles.py, api/catalog.py, api/search.py) ──
// Every call takes the UI language: the backend returns one language under
// the plain field names.

// Small lists that rarely change are cached per language for the visit.
// A failed request is not cached, so retrying refetches.
const cache = new Map();
function cached(key, load) {
  if (!cache.has(key)) {
    cache.set(key, load().catch((err) => {
      cache.delete(key);
      throw err;
    }));
  }
  return cache.get(key);
}

const q = (lang) => `lang=${encodeURIComponent(lang)}`;

/** GET /articles → [{ id, title, lang, body (markdown), related_articles: [id] }] */
export const getArticles = (lang) => cached(`articles:${lang}`, () => request(`/articles?${q(lang)}`));

/** GET /catalog/titles → [{ id, name, stability, salary, branch }] */
export const getCatalogTitles = (lang) => cached(`catalog-titles:${lang}`, () => request(`/catalog/titles?${q(lang)}`));

/** GET /catalog/branches → sorted branch names */
export const getCatalogBranches = (lang) => cached(`catalog-branches:${lang}`, () => request(`/catalog/branches?${q(lang)}`));

/** POST /catalog/search → full catalog docs whose text matches any query word (either language). */
export const searchCatalog = (query, lang, signal) =>
  request(`/catalog/search?${q(lang)}`, { method: 'POST', body: { query }, signal });

/** POST /catalog/branch → full catalog docs of one branch (named in either language). */
export const getCatalogBranch = (branch, lang, signal) =>
  request(`/catalog/branch?${q(lang)}`, { method: 'POST', body: { branch }, signal });

/** GET /catalog/{id} → one full catalog doc. */
export const getCatalogDoc = (id, lang, signal) => request(`/catalog/${encodeURIComponent(id)}?${q(lang)}`, { signal });

/**
 * POST /majors/search with any of { query, tags, mbti, hs, gpa, lat, lon }
 * (combined with AND; lat + lon → within 100 km, closest first, with distance_km).
 */
export const searchMajors = (filters, lang, signal) =>
  request(`/majors/search?${q(lang)}`, { method: 'POST', body: filters, signal, timeoutMs: SLOW_MS });

/** GET /majors/titles → [{ id, full_name, hs, gpa }] for every department. */
export const getMajorTitles = (lang) => cached(`major-titles:${lang}`, () => request(`/majors/titles?${q(lang)}`, { timeoutMs: SLOW_MS }));

/** GET /majors/{dept_id} → one localized majors_info doc ({ id, full_name, description, … }). */
export const getMajor = (id, lang, signal) => request(`/majors/${encodeURIComponent(id)}?${q(lang)}`, { signal });
