// Port of lib/screens/loading_screen.dart.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, GhostButton, Icon } from '../theme/widgets';
import './loading.css';

const ASYMPTOTE_CAP = 0.92;
const FINISH_MS = 260;
const HOLD_MS = 180;

/** Keeps the latest value in a ref, so effects can call fresh callbacks without re-running. */
function useLatest(value) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Waits on whatever async `task` its caller hands it and paces its progress
 * bar off that task's real lifecycle:
 *
 * - While `task` runs, progress creeps toward (never reaching) a cap.
 *   `estimatedMs` only tunes how fast it creeps; it is never a timeout.
 * - When `task` resolves, the bar fills the rest of the way, holds briefly,
 *   then `onDone(result)` fires.
 * - If `task` throws, `onError(error)` is called if given; when it is
 *   missing or returns false, this screen shows its own retry state.
 *
 * `task` is a function, not a promise, so retry can re-run the work.
 * `message` defaults to the "analyzing your answers" text.
 */
export default function LoadingScreen({ task, onDone, onError, message, estimatedMs = 2200 }) {
  const { s } = useLang();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const taskRef = useLatest(task);
  const onDoneRef = useLatest(onDone);
  const onErrorRef = useLatest(onError);

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    let current = 0;
    const set = (p) => {
      current = p;
      setProgress(p);
    };

    setError(null);
    set(0);

    // Creep: cap * (1 - e^(-t / halfLife)).
    const start = performance.now();
    const halfLife = Math.max(0.35, (estimatedMs / 1000) * 0.5);
    const creep = (now) => {
      if (cancelled) return;
      set(ASYMPTOTE_CAP * (1 - Math.exp(-(now - start) / 1000 / halfLife)));
      frame = requestAnimationFrame(creep);
    };
    frame = requestAnimationFrame(creep);

    // Fill the rest of the way, then hold so "done" is visible.
    const settle = () =>
      new Promise((resolve) => {
        cancelAnimationFrame(frame);
        const from = current;
        const t0 = performance.now();
        const step = (now) => {
          if (cancelled) return resolve();
          const k = Math.min(1, (now - t0) / FINISH_MS);
          set(from + (1 - from) * k);
          if (k < 1) frame = requestAnimationFrame(step);
          else setTimeout(resolve, HOLD_MS);
        };
        frame = requestAnimationFrame(step);
      });

    (async () => {
      try {
        const result = await taskRef.current();
        if (cancelled) return;
        await settle();
        if (!cancelled) onDoneRef.current(result);
      } catch (err) {
        if (cancelled) return;
        cancelAnimationFrame(frame);
        console.error('Loading task failed:', err);
        const handled = onErrorRef.current?.(err);
        if (!handled) setError(err);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [attempt, estimatedMs, taskRef, onDoneRef, onErrorRef]);

  return (
    <div className="screen-center">
      <AppCard padding={`${hp(6)} ${wp(4)}`}>
        <div className="loading__inner" aria-busy={!error}>
          {error ? (
            <>
              <Icon name="error" filled={false} size="40px" color="var(--color-accent)" />
              <p style={{ ...AppText.display({ percent: 2.2, min: 13, max: 18 }), marginTop: hp(2), textAlign: 'center' }}>
                {s.loading.error}
              </p>
              <div style={{ marginTop: hp(2.4) }}>
                <GhostButton label={s.loading.retry} onClick={() => setAttempt((a) => a + 1)} />
              </div>
            </>
          ) : (
            <>
              <p style={{ ...AppText.display({ percent: 2.6, min: 15, max: 22 }), textAlign: 'center' }}>
                {message ?? s.loading.analyzing}
              </p>
              <div
                className="loading__track"
                role="progressbar"
                aria-label={message ?? s.loading.analyzing}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                style={{ marginTop: hp(2.4), height: `clamp(4px, ${hp(0.7)}, 8px)` }}
              >
                <div className="loading__fill" style={{ width: `${Math.min(1, progress) * 100}%` }} />
              </div>
            </>
          )}
        </div>
      </AppCard>
    </div>
  );
}

