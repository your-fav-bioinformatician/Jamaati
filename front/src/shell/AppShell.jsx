// Port of lib/app_shell.dart: AppFrame wraps every screen; NavShell adds
// the top nav (everything except the full-screen loading screens).
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { wpClamp } from '../theme/responsive';
import { BridgeMark, IconButton, ThemeToggle } from '../theme/widgets';
import { ROUTES, parentOf } from '../paths';
import './shell.css';

export function AppFrame() {
  return (
    <div className="app-frame">
      <Outlet />
    </div>
  );
}

export function NavShell() {
  return (
    <>
      <TopNav />
      <main className="nav-body">
        <Outlet />
      </main>
    </>
  );
}

/**
 * In-app back: steps back through the browser history when there is an
 * in-app entry to return to, otherwise goes to the screen's logical parent
 * (e.g. after opening a deep link in a new tab).
 */
export function useBack() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate(parentOf(pathname), { replace: true });
  };
}

function TopNav() {
  const { s, toggleLang } = useLang();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const back = useBack();
  const isHome = pathname === ROUTES.landing;

  return (
    <header className="top-nav">
      {!isHome && <IconButton icon="arrow_back" label={s.common.back} onClick={back} mirror />}
      <button type="button" className="top-nav__brand" onClick={() => navigate(ROUTES.landing)}>
        <BridgeMark size={wpClamp(3.6, 28, 40)} />
        <span style={AppText.display({ percent: 2.6, min: 16, max: 22 })}>{s.appName}</span>
      </button>
      <span className="top-nav__spacer" />
      <button
        type="button"
        className="btn btn--ghost top-nav__lang"
        onClick={toggleLang}
        aria-label={s.nav.langToggleLabel}
        title={s.nav.langToggleLabel}
        style={AppText.body({ percent: 1.8, color: null, weight: 600 })}
      >
        {s.nav.langToggle}
      </button>
      <ThemeToggle />
    </header>
  );
}
