// The quiz's opening steps: every field of the backend's UserInfoRequest,
// which /init needs before it can pick questions. Layout ported from
// lib/screens/profile_screen.dart; answers live in the quiz session (1 h
// TTL) rather than in any account or profile. The payload rules are in
// ./intake.js.
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LangProvider';
import { CAREER_GOALS, CITY_GROUPS, GENDERS, INCOME_LEVELS, LANGUAGES, MBTI_TEST_URL, MBTI_TYPES, RELIGIONS, TRACKS, optionLabel } from '../i18n/options';
import { useSession } from '../session/SessionProvider';
import { useToast } from '../theme/Toast';
import { AppText } from '../theme/text';
import { hp, sp, wp } from '../theme/responsive';
import { AppCard, FieldInput, FieldLabel, FieldSelect, GhostButton, PrimaryButton, SecondaryButton, SelectableCard, StepTransition, ToggleSwitch } from '../theme/widgets';
import { ROUTES, quizEntryFor } from '../paths';
import { INTAKE_STEPS, emptyIntake, hasLocation, intakeKey, latestBirthDate, readIntake, toPayload, validateStep } from './intake';
import './intake.css';

export default function IntakeScreen({ step }) {
  const { s } = useLang();
  const { session, update } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const p = s.intake;

  const data = readIntake(session.intake) ?? emptyIntake();
  const set = (patch) => update((cur) => ({ intake: { ...(readIntake(cur.intake) ?? emptyIntake()), ...patch } }));

  // Slide forward or back depending on which way the step changed.
  const lastStep = useRef(step);
  const forward = step >= lastStep.current;
  useEffect(() => {
    lastStep.current = step;
  }, [step]);

  const goNext = () => {
    const error = validateStep(step, data, p.messages);
    if (error) return toast(error);

    if (step < INTAKE_STEPS) {
      navigate(ROUTES.intake(step + 1), { state: { fromStep: step } });
      return;
    }

    // Unchanged answers resume the quiz already running for them; changed
    // answers need a new backend session, since eligibility depends on them.
    const key = intakeKey(toPayload(data));
    if (session.userId && session.intakeKey === key) {
      navigate(quizEntryFor(session));
      return;
    }
    if (session.userId) {
      update({ userId: null, intakeKey: null, answered: 0, done: false, results: null, feedback: null });
    }
    navigate(ROUTES.preparing);
  };

  const goBack = () => {
    if (step === 1) return;
    // Pop the history entry when we came from the previous step, so the
    // browser's back and this button stay in step.
    if (location.state?.fromStep === step - 1) navigate(-1);
    else navigate(ROUTES.intake(step - 1), { replace: true });
  };

  const StepBody = [Step1, Step2, Step3][step - 1];

  return (
    <div className="intake">
      <div className="intake__inner">
        <Stepper steps={p.steps} current={step - 1} label={p.stepperLabel} />

        <AppCard padding={`${hp(3.4)} ${wp(3.4)}`}>
          <h1 style={AppText.display({ percent: 3.4, min: 18, max: 28 })}>{p.steps[step - 1]}</h1>
          <div style={{ marginTop: hp(2.4) }}>
            <StepTransition animKey={step} forward={forward}>
              <StepBody data={data} set={set} />
            </StepTransition>
          </div>
          <div className="intake__actions" style={{ marginTop: hp(2) }}>
            <GhostButton label={p.back} onClick={goBack} visible={step !== 1} />
            <PrimaryButton label={step === INTAKE_STEPS ? p.step3.startQuiz : p.next} onClick={goNext} />
          </div>
        </AppCard>
      </div>
    </div>
  );
}

// ── stepper ──────────────────────────────────────────────────────────────

function Stepper({ steps, current, label }) {
  const { num } = useLang();
  return (
    <ol className="stepper" aria-label={label}>
      {steps.map((name, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={i} className={`stepper__item${done ? ' is-done' : ''}${active ? ' is-active' : ''}`} aria-current={active ? 'step' : undefined}>
            <span className="stepper__dot" style={AppText.display({ percent: 2, color: null, min: 13, max: 17 })}>
              {done ? '✓' : num(i + 1)}
            </span>
            <span
              className="stepper__label"
              style={
                active
                  ? AppText.display({ percent: 2.2, min: 14, max: 18 })
                  : AppText.body({ percent: 1.9, color: done ? 'var(--color-text)' : 'var(--color-primary)' })
              }
            >
              {name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────

/** A labelled field; `optional` appends the localized "(optional)". */
function Field({ label, htmlFor, children, as, optional = false }) {
  const { s } = useLang();
  return (
    <div className="intake__field">
      <FieldLabel htmlFor={htmlFor} as={as}>
        {label}
        {optional && <span className="intake__optional"> {s.common.optional}</span>}
      </FieldLabel>
      {children}
    </div>
  );
}

const helperStyle = (color = 'var(--color-primary)') => ({
  ...AppText.body({ percent: 1.5, color }),
  marginTop: hp(0.8),
});

// ── step 1: about you ────────────────────────────────────────────────────

function Step1({ data, set }) {
  const { s, lang } = useLang();
  const toast = useToast();
  const s1 = s.intake.step1;
  const m = s.intake.messages;
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (locating) return;
    if (!navigator.geolocation) return toast(m.locationUnavailable);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        set({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        toast(m.locationUnavailable);
      },
      { timeout: 15_000 },
    );
  };

  return (
    <div className="intake__stack">
      <div className="intake__row">
        <Field label={s1.birthDate} htmlFor="intake-dob" optional>
          {/* max = the latest birth date that is 14 today, so the picker can't go younger. */}
          <FieldInput id="intake-dob" type="date" min="1940-01-01" max={latestBirthDate()} value={data.birthDate ?? ''} onChange={(v) => set({ birthDate: v || null })} />
          <p style={helperStyle()}>{s1.birthDateHelper}</p>
        </Field>
        <Field label={s1.gender} as="span">
          <div className="segmented" role="group" aria-label={s1.gender}>
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                className={`segmented__option${data.gender === g.value ? ' is-selected' : ''}`}
                aria-pressed={data.gender === g.value}
                onClick={() => set({ gender: g.value })}
                style={AppText.body({ percent: 1.9, color: null })}
              >
                {optionLabel(g, lang)}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="intake__row">
        <Field label={s1.city} htmlFor="intake-city" optional>
          <FieldSelect id="intake-city" options={CITY_GROUPS} placeholder={s1.city} clearable value={data.city} onChange={(v) => set({ city: v })} />
        </Field>
        <Field label={s1.religion} htmlFor="intake-religion" optional>
          <FieldSelect id="intake-religion" options={RELIGIONS} placeholder={s1.religion} clearable value={data.religion} onChange={(v) => set({ religion: v })} />
        </Field>
      </div>

      <div className="intake__row">
        <Field label={s1.language} htmlFor="intake-language" optional>
          <FieldSelect id="intake-language" options={LANGUAGES} placeholder={s1.language} clearable value={data.language} onChange={(v) => set({ language: v })} />
        </Field>
        <Field label={s1.income} htmlFor="intake-income" optional>
          <FieldSelect id="intake-income" options={INCOME_LEVELS} placeholder={s1.income} clearable value={data.income} onChange={(v) => set({ income: v })} />
          <p style={helperStyle()}>{s1.incomeHelper}</p>
        </Field>
      </div>

      <div className="selectable-card intake__close" style={{ padding: `${hp(2)} ${wp(2.6)}` }}>
        <button
          type="button"
          role="switch"
          aria-checked={data.preferClose}
          className="intake__switch-row"
          onClick={() => set({ preferClose: !data.preferClose })}
        >
          <span style={AppText.body({ percent: 1.9 })}>{s1.closeUni}</span>
          <ToggleSwitch on={data.preferClose} />
        </button>
        {data.preferClose && (
          <div style={{ marginTop: hp(1.4) }}>
            <SecondaryButton
              label={locating ? s1.locating : hasLocation(data) ? `✓ ${m.locationSaved}` : `📍 ${s1.useLocation}`}
              onClick={locate}
              disabled={locating}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── step 2: studies ──────────────────────────────────────────────────────

function Step2({ data, set }) {
  const { s, lang } = useLang();
  const s2 = s.intake.step2;

  return (
    <div className="intake__stack intake__stack--loose">
      <Field label={s2.gpa} htmlFor="intake-gpa">
        <FieldInput id="intake-gpa" inputMode="numeric" placeholder={s2.gpaPlaceholder} value={data.gpaText} onChange={(v) => set({ gpaText: v })} />
        <p style={helperStyle()}>{s2.gpaHelper}</p>
      </Field>

      <Field label={s2.track} as="span">
        <div className="intake__tracks" role="group" aria-label={s2.track}>
          {TRACKS.map((t) => (
            <SelectableCard key={t.value} selected={data.track === t.value} onClick={() => set({ track: t.value })} padding={`${hp(2.2)} 0`} className="intake__track">
              <span aria-hidden="true" style={{ fontSize: sp(3.2, 20, 30) }}>
                {t.icon}
              </span>
              <span style={{ ...AppText.display({ percent: 2.2, min: 14, max: 18, color: data.track === t.value ? 'var(--color-accent)' : 'var(--color-text)' }), marginTop: hp(0.8) }}>
                {optionLabel(t, lang)}
              </span>
            </SelectableCard>
          ))}
        </div>
      </Field>

      <Field label={s2.mbti} htmlFor="intake-mbti">
        <p className="intake__mbti-help" style={{ ...AppText.body({ percent: 1.5, color: 'var(--color-primary)' }), marginBottom: hp(0.8) }}>
          {s2.mbtiUnsure}{' '}
          <a href={MBTI_TEST_URL[lang]} target="_blank" rel="noopener noreferrer">
            {s2.mbtiTest} ↗
          </a>
        </p>
        <FieldSelect id="intake-mbti" options={MBTI_TYPES} placeholder={s2.mbtiPlaceholder} value={data.mbti} onChange={(v) => set({ mbti: v })} />
      </Field>
    </div>
  );
}

// ── step 3: goals ────────────────────────────────────────────────────────

function Step3({ data, set }) {
  const { s, lang } = useLang();
  const s3 = s.intake.step3;

  return (
    <div>
      <p id="intake-priority" style={AppText.body({ percent: 1.9, color: 'var(--color-primary)' })}>
        {s3.priority}
      </p>
      <div className="intake__priorities" role="group" aria-labelledby="intake-priority" style={{ marginTop: hp(1.8) }}>
        {CAREER_GOALS.map((goal) => {
          const selected = data.careerGoal === goal.value;
          return (
            <SelectableCard key={goal.value} selected={selected} onClick={() => set({ careerGoal: goal.value })} className="intake__priority">
              <span aria-hidden="true" style={{ fontSize: sp(3.6, 22, 34) }}>
                {goal.icon}
              </span>
              <span style={{ ...AppText.display({ percent: 2.4, min: 15, max: 19, color: selected ? 'var(--color-accent)' : 'var(--color-text)' }), marginTop: hp(0.8) }}>
                {optionLabel(goal, lang)}
              </span>
              <span style={{ ...AppText.body({ percent: 1.5, color: 'var(--color-primary)' }), marginTop: hp(0.6) }}>{lang === 'ar' ? goal.descAr : goal.descEn}</span>
              {selected && (
                <span className="intake__check" aria-hidden="true">
                  ✓
                </span>
              )}
            </SelectableCard>
          );
        })}
      </div>
    </div>
  );
}
