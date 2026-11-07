// Majors search: POST /majors/search (api/search.py) with whichever filters
// are set (combined with AND). Every filter lives in the URL
// (?q, hs, gpa, mbti, lat, lon), so a reload or the back button from a
// department restores the same search.
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { searchMajors } from '../api/client';
import { useFetch } from '../api/useFetch';
import { fill } from '../i18n';
import { useLang } from '../i18n/LangProvider';
import { MBTI_TYPES, TRACKS, isOption } from '../i18n/options';
import { useToast } from '../theme/Toast';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, FieldInput, FieldLabel, FieldSelect, GhostButton, Icon, SecondaryButton, ToggleSwitch } from '../theme/widgets';
import { EmptyState, Fetched, PageHeader } from '../shared/Status';
import { MajorCard } from '../shared/MajorCard';
import { useSyncedParam } from '../shared/useSyncedParam';
import { parseGpa } from '../quiz/intake';
import '../shared/page.css';
import './search.css';

const PAGE_SIZE = 20;

export default function SearchScreen() {
  const { s, lang } = useLang();
  const t = s.search;
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [text, setText, query] = useSyncedParam('q');
  const [gpaText, setGpaText, gpaParam] = useSyncedParam('gpa', 500);
  const [locating, setLocating] = useState(false);

  const hs = isOption(TRACKS, params.get('hs')) ? params.get('hs') : null;
  const mbti = isOption(MBTI_TYPES, params.get('mbti')) ? params.get('mbti') : null;
  const lat = Number.parseFloat(params.get('lat'));
  const lon = Number.parseFloat(params.get('lon'));
  const near = Number.isFinite(lat) && Number.isFinite(lon);
  const gpa = parseGpa(gpaParam);

  const filters = {
    ...(query.trim() && { query: query.trim() }),
    ...(hs && { hs }),
    ...(mbti && { mbti }),
    ...(gpa !== null && { gpa }),
    ...(near && { lat, lon }),
  };
  const active = Object.keys(filters).length > 0;
  const key = `${JSON.stringify(filters)}|${lang}`;
  const result = useFetch((signal) => searchMajors(filters, lang, signal), key, active);

  const setParam = (name, value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null || value === undefined || value === '') next.delete(name);
        else next.set(name, value);
        return next;
      },
      { replace: true },
    );

  const toggleNear = () => {
    if (near) {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('lat');
          next.delete('lon');
          return next;
        },
        { replace: true },
      );
      return;
    }
    if (!navigator.geolocation) return toast(t.locationUnavailable);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.set('lat', pos.coords.latitude.toFixed(4));
            next.set('lon', pos.coords.longitude.toFixed(4));
            return next;
          },
          { replace: true },
        );
      },
      () => {
        setLocating(false);
        toast(t.locationUnavailable);
      },
      { timeout: 15_000 },
    );
  };

  const clearAll = () => setParams({}, { replace: true });

  return (
    <div className="page">
      <div className="page__inner">
        <PageHeader title={t.title} subtitle={t.subtitle} />

        <AppCard padding={`${hp(2.6)} ${wp(2.6)}`} className="search__filters">
          <div className="search__query">
            <label className="visually-hidden" htmlFor="search-query">
              {t.query}
            </label>
            <FieldInput id="search-query" type="search" placeholder={t.queryPlaceholder} value={text} onChange={setText} suffix={<Icon name="search" size="20px" />} />
          </div>

          <div className="search__grid">
            <div>
              <FieldLabel htmlFor="search-hs">{t.track}</FieldLabel>
              <FieldSelect id="search-hs" options={TRACKS} placeholder={t.anyTrack} clearable value={hs} onChange={(v) => setParam('hs', v)} />
            </div>
            <div>
              <FieldLabel htmlFor="search-gpa">{t.gpa}</FieldLabel>
              <FieldInput id="search-gpa" inputMode="numeric" placeholder={s.intake.step2.gpaPlaceholder} value={gpaText} onChange={setGpaText} />
              <p style={{ ...AppText.body({ percent: 1.4, color: gpaText.trim() && gpa === null ? 'var(--color-accent)' : 'var(--color-primary)' }), marginTop: hp(0.6) }}>
                {gpaText.trim() && parseGpa(gpaText) === null ? s.intake.messages.gpaInvalid : t.gpaHelper}
              </p>
            </div>
            <div>
              <FieldLabel htmlFor="search-mbti">{t.mbti}</FieldLabel>
              <FieldSelect id="search-mbti" options={MBTI_TYPES} placeholder={t.anyMbti} clearable value={mbti} onChange={(v) => setParam('mbti', v)} />
            </div>
          </div>

          <div className="search__footer">
            <button type="button" role="switch" aria-checked={near} className="search__near" onClick={toggleNear} disabled={locating}>
              <ToggleSwitch on={near} />
              <span style={AppText.body({ percent: 1.7 })}>{locating ? t.locating : t.nearMe}</span>
            </button>
            {active && <GhostButton label={t.clear} onClick={clearAll} />}
          </div>
        </AppCard>

        <div style={{ marginTop: hp(3) }}>
          {active ? (
            <Fetched result={result}>{(majors) => <Results key={key} majors={majors} />}</Fetched>
          ) : (
            <EmptyState icon="travel_explore" title={t.prompt} />
          )}
        </div>
      </div>
    </div>
  );
}

function Results({ majors }) {
  const { s, num } = useLang();
  // Remounted (keyed by the search) for every new search, so paging restarts.
  const [shown, setShown] = useState(PAGE_SIZE);

  if (!majors.length) return <EmptyState title={s.search.empty} />;

  return (
    <>
      <p className="count-line" style={AppText.body({ percent: 1.6, color: 'var(--color-primary)' })} aria-live="polite">
        {fill(s.search.count, { n: num(majors.length) })}
      </p>
      <ul className="card-grid">
        {majors.slice(0, shown).map((m) => (
          <li key={m.id}>
            <MajorCard major={m} />
          </li>
        ))}
      </ul>
      {shown < majors.length && (
        <div className="more-row">
          <SecondaryButton label={s.common.showMore} onClick={() => setShown((n) => n + PAGE_SIZE)} />
        </div>
      )}
    </>
  );
}
