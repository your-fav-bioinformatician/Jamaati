// Port of lib/screens/landing_page.dart: the four module tiles.
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, sp, wpClamp } from '../theme/responsive';
import { AppCard, BridgeMark, HoverLift, Icon } from '../theme/widgets';
import './landing.css';

const MODULES = [
  { id: 'quiz', icon: 'quiz' },
  { id: 'articles', icon: 'article' },
  { id: 'catalog', icon: 'view_list' },
  { id: 'search', icon: 'search' },
];

function LandingModule({ title, icon, onClick }) {
  return (
    <HoverLift>
      {(hovering) => (
        <button type="button" className={`landing-module${hovering ? ' is-hovering' : ''}`} onClick={onClick}>
          <Icon name={icon} size={sp(3.5, 24, 40)} color="var(--color-primary)" />
          <span style={AppText.display({ percent: 2.2, min: 14, max: 22 })}>{title}</span>
        </button>
      )}
    </HoverLift>
  );
}

/** `onSelect(moduleId)` receives 'quiz' | 'articles' | 'catalog' | 'search'. */
export default function Landing({ onSelect }) {
  const { s } = useLang();

  return (
    <div className="landing">
      <div className="landing__inner">
        <BridgeMark size={wpClamp(11, 56, 96)} />
        <h1 style={{ ...AppText.display({ percent: 4.6 }), marginTop: hp(1.6) }}>{s.appName}</h1>

        <AppCard className="landing__card" style={{ marginTop: hp(4) }}>
          <div className="landing__grid">
            {MODULES.map((m) => (
              <LandingModule key={m.id} title={s.landing[m.id]} icon={m.icon} onClick={() => onSelect(m.id)} />
            ))}
          </div>
        </AppCard>
      </div>
    </div>
  );
}
