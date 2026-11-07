// Answers to the quiz's intake steps, shaped for the backend's
// UserInfoRequest (app/models.py).
//
// Payload contract (what POST /init receives):
//   age           int ≥ 14, or null (birth date is optional)
//   gender        "F" | "M"                                      required
//   income        "low" | "medium" | "high", or null
//   city          English city name (outside the Kurdistan Region), or null
//   religion      English religion name, or null
//   language      English language name (mother tongue), or null
//   gpa           int, 50..105                                   required
//   hs            "Sci" | "Lit" | "Arts"                          required
//   mbti          one of the 16 types                             required
//   career_goal   "Profit" | "Family" | "Dreams" | "Fulfillment"  required
//   lat, lon      numbers when prefer_close, otherwise null
//   prefer_close  boolean
//
// Selections are stored as those wire values (see i18n/options.js), so the
// payload never depends on the UI language.
import { CAREER_GOALS, CITY_GROUPS, GENDERS, INCOME_LEVELS, LANGUAGES, MBTI_TYPES, RELIGIONS, TRACKS, isOption } from '../i18n/options';

export const INTAKE_STEPS = 3;
export const MIN_AGE = 14;
export const MIN_GPA = 50;
export const MAX_GPA = 105;

// Bumped when the stored shape changes; older stored answers are dropped.
const INTAKE_VERSION = 2;

export const emptyIntake = () => ({
  v: INTAKE_VERSION,
  // Step 1: about you
  birthDate: null, // 'YYYY-MM-DD', optional
  gender: null,
  city: null,
  religion: null,
  language: null,
  income: null,
  preferClose: false,
  lat: null,
  lon: null,
  // Step 2: studies
  gpaText: '',
  track: null,
  mbti: null,
  // Step 3: goals
  careerGoal: null,
});

/** The stored intake if it has the current shape, otherwise null. */
export const readIntake = (stored) => (stored?.v === INTAKE_VERSION ? stored : null);

const isSet = (v) => v !== null && v !== undefined;
export const hasLocation = (d) => typeof d.lat === 'number' && typeof d.lon === 'number';

const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The latest birth date that is at least MIN_AGE years old today (the date picker's max). */
export function latestBirthDate(today = new Date()) {
  const d = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  return isoDate(d);
}

/** Age in whole years on [today], or null for a missing or unparsable date. */
export function ageFrom(birthDate, today = new Date()) {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  let years = today.getFullYear() - y;
  const hadBirthday = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  if (!hadBirthday) years--;
  return years;
}

/** Arabic-Indic / Persian digits and Arabic or comma decimal separators → ASCII. */
function asciiNumber(input) {
  return input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[٫,]/g, '.');
}

/** The GPA as an integer in MIN_GPA..MAX_GPA, or null. "92" and "92.0" are fine; "92.5" is not. */
export function parseGpa(raw) {
  const text = asciiNumber(String(raw ?? '').trim());
  if (!/^\d+(\.0+)?$/.test(text)) return null;
  const value = Math.trunc(Number(text));
  return value >= MIN_GPA && value <= MAX_GPA ? value : null;
}

const cityValues = CITY_GROUPS;
const optionalOk = (list, v) => !isSet(v) || isOption(list, v);

/** A localized error message if [step] (1-based) isn't complete and valid, otherwise null. */
export function validateStep(step, d, m) {
  switch (step) {
    case 1: {
      if (!isOption(GENDERS, d.gender)) return m.incomplete;
      if (d.birthDate) {
        const age = ageFrom(d.birthDate);
        if (age === null || age < MIN_AGE) return m.tooYoung;
      }
      if (!optionalOk(cityValues, d.city) || !optionalOk(RELIGIONS, d.religion) || !optionalOk(LANGUAGES, d.language) || !optionalOk(INCOME_LEVELS, d.income)) {
        return m.incomplete;
      }
      if (d.preferClose && !hasLocation(d)) return m.locationNeeded;
      return null;
    }
    case 2:
      if (!d.gpaText.trim() || !isOption(TRACKS, d.track) || !isOption(MBTI_TYPES, d.mbti)) return m.incomplete;
      return parseGpa(d.gpaText) === null ? m.gpaInvalid : null;
    default:
      return isOption(CAREER_GOALS, d.careerGoal) ? null : m.incomplete;
  }
}

/** The first incomplete step (1-based), or null when every step is complete. */
export function firstInvalidStep(intake) {
  const d = readIntake(intake);
  if (!d) return 1;
  // Only null-vs-message matters here, so any truthy messages do.
  const m = { incomplete: 1, tooYoung: 1, gpaInvalid: 1, locationNeeded: 1 };
  for (let step = 1; step <= INTAKE_STEPS; step++) {
    if (validateStep(step, d, m) !== null) return step;
  }
  return null;
}

/** Body for POST /init. Call only once every step validates. */
export function toPayload(d) {
  const nearby = d.preferClose && hasLocation(d);
  return {
    age: d.birthDate ? ageFrom(d.birthDate) : null,
    gender: d.gender,
    income: d.income ?? null,
    city: d.city ?? null,
    religion: d.religion ?? null,
    language: d.language ?? null,
    gpa: parseGpa(d.gpaText),
    hs: d.track,
    mbti: d.mbti,
    career_goal: d.careerGoal,
    lat: nearby ? d.lat : null,
    lon: nearby ? d.lon : null,
    prefer_close: Boolean(d.preferClose),
  };
}

/** Identifies a payload, so an unchanged intake resumes the same backend session. */
export const intakeKey = (payload) => JSON.stringify(payload);
