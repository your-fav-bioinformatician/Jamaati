// Quiz session persisted in localStorage with a sliding 1 h TTL.
//
// It mirrors the backend's SessionManager (app/session_manager.py), which
// keeps a quiz session alive for 1 h after its last use. Every write here
// pushes `expiresAt` an hour forward; a session found past `expiresAt` is
// deleted on read. The two clocks can drift (e.g. the server restarts), so
// a 410 Gone from the backend also ends the session (see SessionProvider).
//
// Shape (all fields optional):
//   intake     answers to the intake steps (see quiz/intake.js)
//   userId     backend session id from POST /init
//   intakeKey  the exact /init payload userId was created from
//   answered   how many questions have been answered
//   done       the backend has no more questions
//   results    top_depts from the final ranking
//   feedback   { rating, comment, submitted }
//   expiresAt  epoch ms

export const SESSION_TTL_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'jamaati-session';

export const EMPTY_SESSION = Object.freeze({});

export function readSession(now = Date.now()) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { session: EMPTY_SESSION, expired: false };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !(parsed.expiresAt > now)) {
      localStorage.removeItem(STORAGE_KEY);
      return { session: EMPTY_SESSION, expired: true, previous: parsed ?? {} };
    }
    return { session: parsed, expired: false };
  } catch {
    return { session: EMPTY_SESSION, expired: false };
  }
}

/** Saves [data] and restarts its 1 h TTL. Returns what was stored. */
export function writeSession(data, now = Date.now()) {
  const stored = { ...data, expiresAt: now + SESSION_TTL_MS };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or unavailable: the session still lives in memory.
  }
  return stored;
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export const SESSION_STORAGE_KEY = STORAGE_KEY;
