import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounced } from '../api/useFetch';

/**
 * A text input's value kept in the URL query (?name=…), so a search or
 * filter survives reloads and is restored by the back button. Typing
 * updates the URL after a short pause, replacing the history entry rather
 * than adding one per keystroke.
 * Returns [liveValue, setValue, committedValue].
 */
export function useSyncedParam(name, ms = 300) {
  const [params, setParams] = useSearchParams();
  const urlValue = params.get(name) ?? '';
  const [value, setValue] = useState(urlValue);
  const debounced = useDebounced(value, ms);
  const written = useRef(urlValue);
  // setParams changes identity on every navigation; it must not re-trigger
  // the write below, or a stale debounced value would be written back.
  const setParamsRef = useRef(setParams);
  setParamsRef.current = setParams;
  const latest = useRef(value);
  latest.current = value;

  // URL → input (back / forward, or another control clearing the filters).
  useEffect(() => {
    if (urlValue !== written.current) {
      written.current = urlValue;
      setValue(urlValue);
    }
  }, [urlValue]);

  // input → URL, once typing has settled.
  useEffect(() => {
    if (debounced !== latest.current || debounced === written.current) return;
    written.current = debounced;
    setParamsRef.current(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debounced) next.set(name, debounced);
        else next.delete(name);
        return next;
      },
      { replace: true },
    );
  }, [debounced, name]);

  return [value, setValue, urlValue];
}
