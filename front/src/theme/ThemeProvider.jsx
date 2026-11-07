import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';

// Keep in sync with the pre-paint script in index.html.
const STORAGE_KEY = 'jamaati-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext(null);

function readStoredPreference() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Owns the light/dark theme for the whole app.
 *
 * `preference` is what the user picked: 'light', 'dark', or 'system' (follow
 * the OS). `theme` is the palette actually in use, always 'light' or 'dark'.
 * The resolved theme is written to <html data-theme>, which switches every
 * CSS variable in tokens.css, so modules need no theme logic of their own.
 */
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(readStoredPreference);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // Storage unavailable (e.g. private mode): the theme still works for this visit.
    }
  }, [preference]);

  const value = useMemo(
    () => ({
      preference,
      theme,
      setPreference,
      toggleTheme: () => setPreference(theme === 'dark' ? 'light' : 'dark'),
    }),
    [preference, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** `{ theme, preference, setPreference, toggleTheme }` for the current app. */
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
