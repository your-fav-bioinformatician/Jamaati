// One department: GET /majors/{dept_id} (api/search.py), in the UI language.
import { useParams } from 'react-router-dom';
import { getMajor } from '../api/client';
import { useFetch } from '../api/useFetch';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, AppChip } from '../theme/widgets';
import { ErrorState, Fetched } from '../shared/Status';
import { MajorFacts, localizeMajor } from '../shared/MajorCard';
import '../shared/page.css';

export default function MajorScreen() {
  const { id } = useParams();
  const { lang } = useLang();
  const result = useFetch((signal) => getMajor(id, lang, signal), `${id}:${lang}`);

  return (
    <div className="page">
      <div className="page__inner page__inner--narrow">
        {result.status === 'error' && result.error?.status === 404 ? (
          <NotFound />
        ) : (
          <Fetched result={result}>{(doc) => <Major major={localizeMajor(doc, lang)} />}</Fetched>
        )}
      </div>
    </div>
  );
}

function NotFound() {
  const { s } = useLang();
  return <ErrorState message={s.major.notFound} />;
}

function Major({ major }) {
  const { s } = useLang();
  const m = s.major;
  const tags = Array.isArray(major.tags) ? major.tags : [];
  const mbti = Array.isArray(major.mbti) ? major.mbti : [];
  const hasMap = typeof major.lat === 'number' && typeof major.lon === 'number' && !(major.lat === 0 && major.lon === 0);

  return (
    <AppCard as="article" padding={`${hp(4)} ${wp(3.4)}`}>
      <h1 className="bidi" style={AppText.display({ percent: 3.2, min: 20, max: 28 })}>
        {major.full_name}
      </h1>
      <div style={{ marginTop: hp(1.6) }}>
        <MajorFacts major={major} />
      </div>
      {major.gender && m.gender[major.gender] && (
        <div className="chip-row" style={{ marginTop: hp(0.8) }}>
          <AppChip label={m.gender[major.gender]} variant="secondary" fontPercent={1.5} />
        </div>
      )}

      {major.description && (
        <p className="bidi" style={{ ...AppText.body({ percent: 1.9, height: 1.8 }), marginTop: hp(2.4) }}>
          {major.description}
        </p>
      )}

      {tags.length > 0 && (
        <>
          <h2 className="section-title" style={AppText.display({ percent: 2.2, min: 15, max: 19 })}>
            {m.tags}
          </h2>
          <div className="chip-row">
            {tags.map((t) => (
              <AppChip key={t} label={t} />
            ))}
          </div>
        </>
      )}

      {mbti.length > 0 && (
        <>
          <h2 className="section-title" style={AppText.display({ percent: 2.2, min: 15, max: 19 })}>
            {m.mbti}
          </h2>
          <div className="chip-row">
            {mbti.map((t) => (
              <AppChip key={t} label={t} variant="secondary" />
            ))}
          </div>
        </>
      )}

      {(major.web || hasMap) && (
        <div className="chip-row" style={{ marginTop: hp(3), gap: '1vh 2.4vw' }}>
          {major.web && (
            <a className="external-link" href={major.web} target="_blank" rel="noopener noreferrer" style={AppText.body({ percent: 1.8, color: null, weight: 600 })}>
              {m.website} ↗
            </a>
          )}
          {hasMap && (
            <a
              className="external-link"
              href={`https://www.google.com/maps/search/?api=1&query=${major.lat},${major.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              style={AppText.body({ percent: 1.8, color: null, weight: 600 })}
            >
              {m.map} ↗
            </a>
          )}
        </div>
      )}
    </AppCard>
  );
}
