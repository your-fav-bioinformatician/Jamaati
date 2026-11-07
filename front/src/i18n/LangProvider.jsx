import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { DEFAULT_LANG, LANGS, dirFor, stringsFor } from './index';

// Keep in sync with the pre-paint script in index.html. The language is a
// preference, not session data, so it is kept without the session's TTL.
const STORAGE_KEY = 'jamaati-lang';

const LangContext = createContext(null);

function readStoredLang() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(value) ? value : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

/**
 * Owns the UI language. Provides the strings for it (`s`), the text
 * direction, and a number formatter that uses Arabic-Indic digits in Arabic.
 */
export function LangProvider({ children }) {
  const [lang, setLang] = useState(readStoredLang);

  const s = stringsFor(lang);
  const dir = dirFor(lang);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    document.title = s.appName;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage unavailable: the choice still applies for this visit.
    }
  }, [lang, dir, s.appName]);

  const toggleLang = useCallback(() => setLang((l) => (l === 'ar' ? 'en' : 'ar')), []);

  const value = useMemo(() => {
    const numberFormat = new Intl.NumberFormat(lang === 'ar' ? 'ar-u-nu-arab' : 'en', { maximumFractionDigits: 1 });
    return { lang, s, dir, isRtl: dir === 'rtl', toggleLang, num: (n) => numberFormat.format(n) };
  }, [lang, s, dir, toggleLang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

/** `{ lang, s, dir, isRtl, toggleLang, num }` */
export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>');
  return ctx;
}
