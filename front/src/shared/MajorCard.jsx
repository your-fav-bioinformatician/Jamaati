// A department (majors_info document) as a card, used by the quiz results,
// the majors search and the catalog.
import { Link } from 'react-router-dom';
import { fill } from '../i18n';
import { useLang } from '../i18n/LangProvider';
import { TRACKS, findOption, optionLabel } from '../i18n/options';
import { ROUTES } from '../paths';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, AppChip } from '../theme/widgets';
import './major.css';

/**
 * One language of a majors_info document. Works on raw documents (the quiz
 * ranking: full_name Arabic / full_name_en English, description English /
 * description_ar Arabic) and on ones the backend already localized (search,
 * detail), which carry plain `full_name` / `description` and `id`.
 */
export function localizeMajor(doc, lang) {
  const ar = lang === 'ar';
  return {
    ...doc,
    id: doc.id ?? doc.dept_id,
    full_name: (ar ? doc.full_name || doc.full_name_en : doc.full_name_en || doc.full_name) ?? '',
    description: (ar ? doc.description_ar || doc.description : doc.description) ?? '',
  };
}

/** Track, minimum GPA, public/private and distance as small chips. */
export function MajorFacts({ major, small = false }) {
  const { s, lang, num } = useLang();
  const m = s.major;
  const pct = small ? 1.3 : 1.5;
  const track = findOption(TRACKS, major.hs);
  return (
    <div className="chip-row">
      {track && <AppChip label={optionLabel(track, lang)} fontPercent={pct} />}
      {major.gpa != null && <AppChip label={fill(m.minGpa, { gpa: num(Number(major.gpa)) })} variant="secondary" fontPercent={pct} />}
      {typeof major.is_private === 'boolean' && <AppChip label={major.is_private ? m.private : m.public} variant="secondary" fontPercent={pct} />}
      {major.distance_km != null && <AppChip label={fill(m.distance, { km: num(Math.round(major.distance_km)) })} variant="secondary" fontPercent={pct} />}
    </div>
  );
}

function RankBadge({ rank, large }) {
  const { s, num } = useLang();
  return (
    <span
      className={`rank-badge${large ? ' rank-badge--large' : ''}`}
      aria-label={fill(s.results.rank, { n: num(rank) })}
      style={AppText.display({ percent: large ? 4 : 2.6, min: 13, max: 30 })}
    >
      {num(rank)}
    </span>
  );
}

/**
 * The whole card links to the department's page. `rank` shows the position
 * badge; `featured` is the larger "best match" layout.
 */
export function MajorCard({ major, rank, featured = false }) {
  const { s } = useLang();
  const tags = Array.isArray(major.tags) ? major.tags : [];

  return (
    <Link to={ROUTES.major(major.id)} className="card-link">
      <AppCard padding={featured ? `${hp(3.4)} ${wp(3.4)}` : `${hp(2)} ${wp(2.6)}`} className={`major-card${featured ? ' major-card--featured' : ''}`}>
        {featured && (
          <span className="major-card__badge" style={AppText.display({ percent: 1.7, min: 12, max: 15, color: null })}>
            🏆 {s.results.bestMatch}
          </span>
        )}
        <div className="major-card__body">
          {rank != null && <RankBadge rank={rank} large={featured} />}
          <div className="major-card__content">
            <h2
              className={`bidi${featured ? '' : ' clamp-2'}`}
              style={featured ? AppText.display({ percent: 3, min: 18, max: 26 }) : AppText.body({ percent: 1.9, weight: 700 })}
            >
              {major.full_name}
            </h2>
            {major.description && (
              <p
                className={`bidi${featured ? '' : ' clamp-2'}`}
                style={{ ...AppText.body({ percent: featured ? 1.7 : 1.4, color: featured ? undefined : 'var(--color-primary)' }), marginTop: hp(featured ? 1.2 : 0.5) }}
              >
                {major.description}
              </p>
            )}
            <div style={{ marginTop: hp(1) }}>
              <MajorFacts major={major} small={!featured} />
            </div>
            {featured && tags.length > 0 && (
              <div className="chip-row" style={{ marginTop: hp(1) }}>
                {tags.map((t) => (
                  <AppChip key={t} label={t} fontPercent={1.4} />
                ))}
              </div>
            )}
          </div>
        </div>
      </AppCard>
    </Link>
  );
}
