// Port of lib/screens/results_screen.dart.
//
// `results` is the backend's `top_depts` (engine/final_rank.py): majors_info
// documents, best first. Cards keep that order; the badge is the position.
// The backend sends no match score, so there's no percentage ring.
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LangProvider';
import { useSession } from '../session/SessionProvider';
import { AppText } from '../theme/text';
import { hp } from '../theme/responsive';
import { GhostButton, SecondaryButton } from '../theme/widgets';
import { MajorCard, localizeMajor } from '../shared/MajorCard';
import { ROUTES } from '../paths';
import '../shared/page.css';
import './results.css';

export default function ResultsScreen({ results }) {
  const { s, lang } = useLang();
  const { update } = useSession();
  const navigate = useNavigate();
  const r = s.results;
  const [best, ...rest] = results.map((doc) => localizeMajor(doc, lang));

  const retake = () => {
    // Keep the intake answers so they can be reviewed; start a fresh quiz.
    navigate(ROUTES.intake(1));
    update({ userId: null, intakeKey: null, answered: 0, done: false, results: null, feedback: null });
  };

  return (
    <div className="page">
      <div className="page__inner">
        <h1 style={AppText.display({ percent: 3.6, min: 20, max: 30 })}>{r.title}</h1>
        <p style={{ ...AppText.body({ percent: 1.9, color: 'var(--color-primary)' }), marginTop: hp(0.8) }}>{r.subtitle}</p>

        <div style={{ marginTop: hp(3.5) }}>
          {best ? (
            <>
              <MajorCard major={best} rank={1} featured />
              {rest.length > 0 && (
                <ol className="card-grid" start={2} style={{ marginTop: hp(2.2) }}>
                  {rest.map((major, i) => (
                    <li key={major.id ?? i}>
                      <MajorCard major={major} rank={i + 2} />
                    </li>
                  ))}
                </ol>
              )}
            </>
          ) : (
            <div className="results__empty">
              <h2 style={AppText.display({ percent: 2.6, min: 17, max: 22 })}>{r.noMatchesTitle}</h2>
              <p style={{ ...AppText.body({ percent: 1.9, color: 'var(--color-primary)' }), marginTop: hp(1) }}>{r.noMatchesDesc}</p>
            </div>
          )}
        </div>

        <div className="results__actions" style={{ marginTop: hp(3.5) }}>
          <SecondaryButton label={r.feedback} onClick={() => navigate(ROUTES.feedback)} />
          <GhostButton label={r.retake} onClick={retake} />
        </div>
      </div>
    </div>
  );
}
