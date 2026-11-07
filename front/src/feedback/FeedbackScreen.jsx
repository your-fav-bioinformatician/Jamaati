// Port of lib/screens/feedback_screen.dart.
//
// Like the Flutter screen, submitting only records the feedback locally:
// the backend has no feedback endpoint yet. It is kept in the quiz session,
// so a reload keeps the draft or the thank-you state (within the 1 h TTL).
import { useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LangProvider';
import { useSession } from '../session/SessionProvider';
import { AppText } from '../theme/text';
import { hp, sp, wp } from '../theme/responsive';
import { AppCard, FieldInput, FieldLabel, GhostButton, HoverLift, PrimaryButton } from '../theme/widgets';
import { ROUTES } from '../paths';
import './feedback.css';

const FACES = ['😔', '😐', '😊', '🤩'];
const EMPTY_FEEDBACK = { rating: null, comment: '', submitted: false };

export default function FeedbackScreen() {
  const { s } = useLang();
  const { session, update } = useSession();
  const navigate = useNavigate();
  const f = s.feedback;

  const fb = { ...EMPTY_FEEDBACK, ...session.feedback };
  const set = (patch) => update((cur) => ({ feedback: { ...EMPTY_FEEDBACK, ...cur.feedback, ...patch } }));

  if (fb.submitted) {
    return (
      <div className="screen-center">
        <AppCard padding={`${hp(6)} ${wp(4)}`}>
          <div className="feedback__thanks" role="status">
            <span className="feedback__tick" style={{ fontSize: sp(3.2, 22, 34) }} aria-hidden="true">
              ✓
            </span>
            <h1 style={{ ...AppText.display({ percent: 3, min: 18, max: 26 }), marginTop: hp(2.4) }}>{f.thankYou}</h1>
            <p style={{ ...AppText.body({ percent: 1.9 }), marginTop: hp(1) }}>{f.thankYouSub}</p>
            <div style={{ marginTop: hp(2.4) }}>
              <GhostButton label={f.home} onClick={() => navigate(ROUTES.landing)} />
            </div>
          </div>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="screen-center">
      <form
        className="feedback__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (fb.rating !== null) set({ submitted: true });
        }}
      >
        <AppCard padding={`${hp(4.4)} ${wp(3.4)}`}>
          <h1 id="feedback-title" style={{ ...AppText.display({ percent: 2.8, min: 17, max: 22 }), textAlign: 'center' }}>
            {f.title}
          </h1>

          <div className="feedback__faces" role="group" aria-labelledby="feedback-title" style={{ marginTop: hp(3.4) }}>
            {FACES.map((face, i) => {
              const selected = fb.rating === i;
              return (
                <HoverLift key={i} scale={1.08}>
                  {() => (
                    <button
                      type="button"
                      className={`feedback__face${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      aria-label={f.faces[i]}
                      title={f.faces[i]}
                      onClick={() => set({ rating: i })}
                      style={{ fontSize: sp(4.4, 26, 40) }}
                    >
                      {face}
                    </button>
                  )}
                </HoverLift>
              );
            })}
          </div>

          <div style={{ marginTop: hp(3.4) }}>
            <FieldLabel htmlFor="feedback-comment">{f.optional}</FieldLabel>
            <FieldInput id="feedback-comment" rows={4} placeholder={f.placeholder} value={fb.comment} onChange={(v) => set({ comment: v })} />
          </div>

          <div className="feedback__submit" style={{ marginTop: hp(3) }}>
            <PrimaryButton type={fb.rating === null ? 'button' : 'submit'} label={f.submit} />
          </div>
        </AppCard>
      </form>
    </div>
  );
}
