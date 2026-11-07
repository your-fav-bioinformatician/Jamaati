// Port of lib/screens/quiz_screen.dart, against the endpoints in api/quiz.py.
//
// The backend picks questions adaptively and keeps the one waiting for an
// answer in its session, so reloading or coming back to this screen shows
// the same question again. It can't undo an answer, so there's no
// per-question "back"; the back button leaves the quiz, and coming back
// resumes it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SessionGoneError, isFinalRanking, nextQuestion, once, submitAnswer } from '../api/client';
import { translateQuestion } from '../i18n';
import { useLang } from '../i18n/LangProvider';
import { ANSWERS, optionLabel } from '../i18n/options';
import { useSession } from '../session/SessionProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, AppChip, PrimaryButton, SelectableCard, StepTransition } from '../theme/widgets';
import { ROUTES } from '../paths';
import './quiz.css';

export default function QuizScreen() {
  const { s, num, lang } = useLang();
  const { session, update, touch, expire } = useSession();
  const navigate = useNavigate();
  const q = s.quiz;
  const userId = session.userId;
  const answered = session.answered ?? 0;

  const [phase, setPhase] = useState('loading'); // loading | question | error
  const [question, setQuestion] = useState(null); // { id, question }
  const [selected, setSelected] = useState(null); // an ANSWERS value, 1..5
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState(null); // { message, retry }
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fail = useCallback(
    (err, message, retry) => {
      // The guard in routes.jsx sends the user back to the intake.
      if (err instanceof SessionGoneError) return expire();
      setFailure({ message, retry });
      setSubmitting(false);
      setPhase('error');
    },
    [expire],
  );

  /** Pulls the next question; the backend decides how many there are. */
  const loadNext = useCallback(
    async (count) => {
      setPhase('loading');
      setSelected(null);
      setSubmitting(false);
      try {
        const data = await once(`next:${userId}:${count}`, () => nextQuestion(userId));
        if (!mounted.current) return;
        if (isFinalRanking(data)) {
          // No more questions: hand the ranking to the analyzing screen.
          navigate(ROUTES.analyzing, { replace: true, state: { ranking: data } });
          update({ done: true });
          return;
        }
        touch();
        setQuestion(data);
        setPhase('question');
      } catch (err) {
        if (mounted.current) fail(err, q.loadError, () => loadNext(count));
      }
    },
    [userId, navigate, update, touch, fail, q.loadError],
  );

  useEffect(() => {
    loadNext(answered);
    // Load once on entry; later loads follow each answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = async () => {
    if (selected === null || submitting) return;
    setSubmitting(true);
    try {
      // AnswerItem: question_id and answer are both integers; answer is 1..5.
      await submitAnswer(userId, Number(question.id), selected);
    } catch (err) {
      if (!mounted.current) return;
      // 409: the backend is waiting on a different question (e.g. another
      // tab answered this one). Re-sync instead of failing.
      if (err.status === 409) return loadNext(answered);
      return fail(err, q.submitError, handleNext);
    }
    if (!mounted.current) return;
    const count = answered + 1;
    update({ answered: count });
    loadNext(count);
  };

  if (phase === 'error') {
    return (
      <div className="screen-center">
        <div className="quiz__message">
          <p style={{ ...AppText.display({ percent: 2.4, min: 18, max: 24 }), textAlign: 'center' }}>{failure?.message ?? q.loadError}</p>
          <div style={{ marginTop: hp(3) }}>
            <PrimaryButton label={q.retry} onClick={() => failure?.retry()} />
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'loading' || !question) {
    return (
      <div className="screen-center">
        <div className="quiz__message" role="status">
          <span className="spinner" aria-hidden="true" />
          <p style={{ ...AppText.body({ percent: 1.8, color: 'var(--color-primary)' }), marginTop: hp(2) }}>{q.loadingQuestion}</p>
        </div>
      </div>
    );
  }

  const text = translateQuestion(s, question.id, question.question);

  return (
    <div className="quiz">
      <div className="quiz__inner">
        <div className="quiz__header">
          <AppChip label={q.section} />
          <span style={AppText.body({ percent: 1.7, color: 'var(--color-primary)' })}>
            {q.questionLabel} {num(answered + 1)}
          </span>
        </div>

        <div style={{ marginTop: hp(3) }}>
          <StepTransition animKey={question.id} forward>
            <AppCard padding={`${hp(4)} ${wp(4)}`}>
              <h1 id="quiz-question" style={{ ...AppText.body({ percent: 2.6, weight: 600 }), textAlign: 'center' }}>
                {text}
              </h1>
              <div className="quiz__options" role="group" aria-labelledby="quiz-question" style={{ marginTop: hp(3.5) }}>
                {ANSWERS.map((a) => (
                  <OptionCard key={a.value} number={num(a.value)} label={optionLabel(a, lang)} selected={selected === a.value} onClick={() => setSelected(a.value)} />
                ))}
              </div>
              <div className="quiz__actions" style={{ marginTop: hp(3) }}>
                <PrimaryButton label={q.next} onClick={selected === null || submitting ? undefined : handleNext} />
              </div>
            </AppCard>
          </StepTransition>
        </div>
      </div>
    </div>
  );
}

function OptionCard({ number, label, selected, onClick }) {
  return (
    <SelectableCard selected={selected} onClick={onClick} padding={`${hp(2)} ${wp(1)}`} className="quiz__option">
      <span
        className={`quiz__dot${selected ? ' is-selected' : ''}`}
        style={AppText.display({ percent: 1.9, min: 12, max: 16, color: null })}
        aria-hidden="true"
      >
        {selected ? '✓' : number}
      </span>
      <span
        style={{
          ...AppText.body({ percent: 1.35, height: 1.3, color: selected ? 'var(--color-accent)' : 'var(--color-primary)' }),
          marginTop: hp(1),
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </SelectableCard>
  );
}
