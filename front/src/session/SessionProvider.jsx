import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../i18n/LangProvider';
import { useToast } from '../theme/Toast';
import { EMPTY_SESSION, SESSION_STORAGE_KEY, clearSession, readSession, writeSession } from './session';

const SessionContext = createContext(null);
const CHECK_INTERVAL_MS = 15_000;

/** True if the session holds anything worth telling the user it expired. */
const hasProgress = (s) => Boolean(s.userId || s.intake || s.results);

/**
 * Holds the quiz session (see session.js) and keeps it in sync with
 * localStorage, other tabs, and its TTL. When it expires, every field is
 * dropped, so the route guards in routes.jsx send the user back to the
 * start of the quiz, and a toast explains why.
 */
export function SessionProvider({ children }) {
  const { s } = useLang();
  const toast = useToast();
  const [initial] = useState(readSession);
  const [session, setSession] = useState(initial.session);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const expiredMessage = useRef(s.session.expired);
  expiredMessage.current = s.session.expired;

  const notifyExpired = useCallback(
    (previous) => {
      if (hasProgress(previous)) toast(expiredMessage.current);
    },
    [toast],
  );

  // A session that expired while the app was closed.
  useEffect(() => {
    if (initial.expired) notifyExpired(initial.previous);
  }, [initial, notifyExpired]);

  // Expire while the app is open, when the tab comes back into view, and
  // follow changes made in other tabs.
  useEffect(() => {
    const check = () => {
      const previous = sessionRef.current;
      if (previous === EMPTY_SESSION || previous.expiresAt > Date.now()) return;
      clearSession();
      setSession(EMPTY_SESSION);
      notifyExpired(previous);
    };
    const onStorage = (e) => {
      if (e.key === SESSION_STORAGE_KEY || e.key === null) setSession(readSession().session);
    };
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('storage', onStorage);
    };
  }, [notifyExpired]);

  /** Merges [patch] (an object, or a function of the current session) and restarts the TTL. */
  const update = useCallback((patch) => {
    const current = sessionRef.current;
    const next = writeSession({ ...current, ...(typeof patch === 'function' ? patch(current) : patch) });
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Restarts the TTL without changing anything (after a successful API call). */
  const touch = useCallback(() => {
    if (sessionRef.current !== EMPTY_SESSION) update({});
  }, [update]);

  /** Ends the session now, e.g. after the backend answered 410 Gone. */
  const expire = useCallback(() => {
    const previous = sessionRef.current;
    clearSession();
    sessionRef.current = EMPTY_SESSION;
    setSession(EMPTY_SESSION);
    notifyExpired(previous);
  }, [notifyExpired]);

  const value = useMemo(() => ({ session, update, touch, expire }), [session, update, touch, expire]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** `{ session, update, touch, expire }` */
export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}
