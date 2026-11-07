import { useCallback, useEffect, useState } from 'react';

/**
 * Runs `load(signal)` whenever `key` changes (pass everything the request
 * depends on, e.g. `${id}:${lang}`) and cancels the previous request.
 * Returns `{ status: 'idle' | 'loading' | 'ready' | 'error', data, error, retry }`.
 * With `enabled = false` nothing is fetched and status is 'idle'.
 */
export function useFetch(load, key, enabled = true) {
  const [state, setState] = useState({ status: enabled ? 'loading' : 'idle', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'idle', data: null, error: null });
      return undefined;
    }
    const controller = new AbortController();
    setState((prev) => ({ status: 'loading', data: prev.data, error: null }));
    Promise.resolve()
      .then(() => load(controller.signal))
      .then(
        (data) => {
          if (!controller.signal.aborted) setState({ status: 'ready', data, error: null });
        },
        (error) => {
          if (controller.signal.aborted) return;
          console.error('Request failed:', error);
          setState({ status: 'error', data: null, error });
        },
      );
    return () => controller.abort();
    // `load` is a fresh closure each render; `key` says when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}

/** `value`, updated only after it has stopped changing for `ms`. */
export function useDebounced(value, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
