// One career: GET /catalog/{id} (api/catalog.py), in the UI language.
// `related_majors` holds dept_ids; their names come from GET /majors/titles
// (cached for the visit) and each links to the department's page.
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCatalogDoc, getMajorTitles } from '../api/client';
import { useFetch } from '../api/useFetch';
import { fill } from '../i18n';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, AppChip, GhostButton } from '../theme/widgets';
import { ErrorState, Fetched, Loading } from '../shared/Status';
import { ROUTES } from '../paths';
import '../shared/page.css';
import './catalog.css';

const PAY_ROWS = [
  ['starting_monthly_pay_iraq', 'starting_monthly_pay_abroad'],
  ['mid_level_pay_iraq', 'mid_level_pay_abroad'],
  ['senior_pay_iraq', 'senior_pay_abroad'],
];
const RELATED_PREVIEW = 8;

export default function CareerScreen() {
  const { id } = useParams();
  const { s, lang } = useLang();
  const result = useFetch((signal) => getCatalogDoc(id, lang, signal), `${id}:${lang}`);

  return (
    <div className="page">
      <div className="page__inner page__inner--narrow">
        {result.status === 'error' && result.error?.status === 404 ? (
          <ErrorState message={s.catalog.notFound} />
        ) : (
          <Fetched result={result}>{(doc) => <Career career={doc} />}</Fetched>
        )}
      </div>
    </div>
  );
}

const sectionTitle = (text) => (
  <h2 className="section-title" style={AppText.display({ percent: 2.2, min: 15, max: 19 })}>
    {text}
  </h2>
);

function Career({ career }) {
  const { s, num } = useLang();
  const c = s.catalog;
  const money = (v) => (typeof v === 'number' ? fill(s.common.iqd, { amount: num(v) }) : '—');
  const hasPay = PAY_ROWS.some(([iq, ab]) => typeof career[iq] === 'number' || typeof career[ab] === 'number');
  const list = (v) => (Array.isArray(v) ? v : []);

  return (
    <AppCard as="article" padding={`${hp(4)} ${wp(3.4)}`}>
      <h1 style={AppText.display({ percent: 3.2, min: 20, max: 28 })}>{career.name}</h1>
      <div className="chip-row" style={{ marginTop: hp(1.4) }}>
        {career.branch && <AppChip label={career.branch} />}
        {career.stability && <AppChip label={`${c.stability}: ${career.stability}`} variant="secondary" />}
      </div>
      {career.description && <p style={{ ...AppText.body({ percent: 1.9, height: 1.8 }), marginTop: hp(2.2) }}>{career.description}</p>}

      {hasPay && (
        <>
          {sectionTitle(c.pay)}
          <div className="pay-table-wrap">
            <table className="pay-table" style={AppText.body({ percent: 1.6 })}>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">{c.pay}</span>
                  </th>
                  <th scope="col">{c.inIraq}</th>
                  <th scope="col">{c.abroad}</th>
                </tr>
              </thead>
              <tbody>
                {PAY_ROWS.map(([iq, ab], i) => (
                  <tr key={iq}>
                    <th scope="row">{c.payLevels[i]}</th>
                    <td>{money(career[iq])}</td>
                    <td>{money(career[ab])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {list(career.skills_set).length > 0 && (
        <>
          {sectionTitle(c.skills)}
          <div className="chip-row">
            {list(career.skills_set).map((t) => (
              <AppChip key={t} label={t} />
            ))}
          </div>
        </>
      )}

      {list(career.workplaces).length > 0 && (
        <>
          {sectionTitle(c.workplaces)}
          <ul className="career__list" style={AppText.body({ percent: 1.8 })}>
            {list(career.workplaces).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </>
      )}

      {list(career.mbti_types).length > 0 && (
        <>
          {sectionTitle(c.mbti)}
          <div className="chip-row">
            {list(career.mbti_types).map((t) => (
              <AppChip key={t} label={t} variant="secondary" />
            ))}
          </div>
        </>
      )}

      {list(career.related_majors).length > 0 && (
        <>
          {sectionTitle(c.relatedMajors)}
          <RelatedMajors ids={list(career.related_majors)} />
        </>
      )}
    </AppCard>
  );
}

function RelatedMajors({ ids }) {
  const { s, lang, num } = useLang();
  const [showAll, setShowAll] = useState(false);
  const titles = useFetch(() => getMajorTitles(lang), lang);

  if (titles.status === 'loading' || titles.status === 'idle') return <Loading />;
  if (titles.status === 'error') return <ErrorState onRetry={titles.retry} />;

  const byId = new Map(titles.data.map((t) => [String(t.id), t]));
  const majors = ids.map((id) => byId.get(String(id))).filter(Boolean);
  const shown = showAll ? majors : majors.slice(0, RELATED_PREVIEW);

  return (
    <>
      <ul className="related-majors">
        {shown.map((m) => (
          <li key={m.id}>
            <Link to={ROUTES.major(m.id)} className="related-major bidi" style={AppText.body({ percent: 1.6, color: null })}>
              {m.full_name}
            </Link>
          </li>
        ))}
      </ul>
      {!showAll && majors.length > RELATED_PREVIEW && (
        <div className="more-row">
          <GhostButton label={fill(s.catalog.showAll, { n: num(majors.length) })} onClick={() => setShowAll(true)} />
        </div>
      )}
    </>
  );
}
