// Port of lib/app_router.dart. Screens stay unaware of the session's
// lifecycle: the route elements below decide, from the session, whether a
// screen can be shown or where to send the user instead.
//
// History rules (so the browser's back button always makes sense):
//   - intake steps are separate history entries, so back = previous step
//   - the two loading screens replace themselves when done, so back never
//     re-runs /init or the ranking
//   - quiz → analyzing → results replaces, so back from results skips the
//     finished quiz
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SessionGoneError, initQuiz, isFinalRanking, nextQuestion, once } from './api/client';
import { fill } from './i18n';
import { useLang } from './i18n/LangProvider';
import { useSession } from './session/SessionProvider';
import { useToast } from './theme/Toast';
import { AppFrame, NavShell } from './shell/AppShell';
import Landing from './landing/Landing';
import LoadingScreen from './loading/LoadingScreen';
import IntakeScreen from './quiz/IntakeScreen';
import QuizScreen from './quiz/QuizScreen';
import ResultsScreen from './results/ResultsScreen';
import FeedbackScreen from './feedback/FeedbackScreen';
import ArticlesScreen from './articles/ArticlesScreen';
import ArticleScreen from './articles/ArticleScreen';
import CatalogScreen from './catalog/CatalogScreen';
import CareerScreen from './catalog/CareerScreen';
import SearchScreen from './search/SearchScreen';
import MajorScreen from './majors/MajorScreen';
import { INTAKE_STEPS, firstInvalidStep, intakeKey, toPayload } from './quiz/intake';
import { ROUTES, quizEntryFor } from './paths';

// Landing-page module id → route. Add future modules here.
const MODULE_ROUTES = {
  articles: ROUTES.articles,
  catalog: ROUTES.catalog,
  search: ROUTES.search,
};

function LandingRoute() {
  const { s } = useLang();
  const { session } = useSession();
  const navigate = useNavigate();
  const toast = useToast();

  const open = (moduleId) => {
    if (moduleId === 'quiz') return navigate(quizEntryFor(session));
    const route = MODULE_ROUTES[moduleId];
    if (route) navigate(route);
    else toast(fill(s.landing.comingSoon, { module: s.landing[moduleId] }));
  };

  return <Landing onSelect={open} />;
}

function PreparingRoute() {
  const { s } = useLang();
  const { session, update } = useSession();
  const navigate = useNavigate();

  const intake = session.intake;
  if (firstInvalidStep(intake) !== null) return <Navigate to={ROUTES.intake(1)} replace />;

  const payload = toPayload(intake);
  const key = intakeKey(payload);

  return (
    <LoadingScreen
      message={s.loading.preparing}
      task={() => once(`init:${key}`, () => initQuiz(payload))}
      onDone={(res) => {
        update({ userId: res.user_id, intakeKey: key, answered: 0, done: false, results: null, feedback: null });
        navigate(ROUTES.quiz, { replace: true });
      }}
    />
  );
}

function QuizRoute() {
  const { session } = useSession();
  if (!session.userId) return <Navigate to={ROUTES.intake(1)} replace />;
  if (session.done) return <Navigate to={session.results ? ROUTES.results : ROUTES.analyzing} replace />;
  return <QuizScreen />;
}

function AnalyzingRoute() {
  const { s } = useLang();
  const { session, update, expire } = useSession();
  const navigate = useNavigate();
  const { state } = useLocation();

  if (!session.userId) return <Navigate to={ROUTES.intake(1)} replace />;
  const userId = session.userId;

  return (
    <LoadingScreen
      message={s.loading.analyzing}
      // The quiz hands over the ranking it already received; otherwise (a
      // reload, or resuming later) ask the backend, which answers /next_q
      // with the ranking once the quiz is done.
      task={() => state?.ranking ?? once(`rank:${userId}`, () => nextQuestion(userId))}
      onDone={(data) => {
        if (isFinalRanking(data)) {
          update({ done: true, results: data.top_depts });
          navigate(ROUTES.results, { replace: true });
        } else {
          update({ done: false });
          navigate(ROUTES.quiz, { replace: true });
        }
      }}
      onError={(err) => {
        if (!(err instanceof SessionGoneError)) return false;
        expire();
        navigate(ROUTES.intake(1), { replace: true });
        return true;
      }}
    />
  );
}

// Results cached before final_rank returned majors_info documents lack dept_id.
const isCurrentResults = (results) => Array.isArray(results) && results.every((r) => r && 'dept_id' in r);

function ResultsRoute() {
  const { session } = useSession();
  if (isCurrentResults(session.results)) return <ResultsScreen results={session.results} />;
  return <Navigate to={session.userId && session.done ? ROUTES.analyzing : ROUTES.intake(1)} replace />;
}

function IntakeRoute() {
  const { pathname } = useLocation();
  const { session } = useSession();
  const step = Number(/(\d+)$/.exec(pathname)?.[1]);

  if (!Number.isInteger(step) || step < 1 || step > INTAKE_STEPS) return <Navigate to={ROUTES.intake(1)} replace />;
  // A later step needs every earlier one to be complete (deep links, reloads, expiry).
  const invalid = firstInvalidStep(session.intake);
  if (invalid !== null && invalid < step) return <Navigate to={ROUTES.intake(invalid)} replace />;

  return <IntakeScreen step={step} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppFrame />}>
        {/* No top nav on the loading screens. */}
        <Route path={ROUTES.preparing} element={<PreparingRoute />} />
        <Route path={ROUTES.analyzing} element={<AnalyzingRoute />} />

        <Route element={<NavShell />}>
          <Route index element={<LandingRoute />} />
          <Route path="/quiz/intake/:step" element={<IntakeRoute />} />
          <Route path={ROUTES.quiz} element={<QuizRoute />} />
          <Route path={ROUTES.results} element={<ResultsRoute />} />
          <Route path={ROUTES.feedback} element={<FeedbackScreen />} />
          <Route path={ROUTES.articles} element={<ArticlesScreen />} />
          <Route path="/articles/:id" element={<ArticleScreen />} />
          <Route path={ROUTES.catalog} element={<CatalogScreen />} />
          <Route path="/catalog/:id" element={<CareerScreen />} />
          <Route path={ROUTES.search} element={<SearchScreen />} />
          <Route path="/majors/:id" element={<MajorScreen />} />
          <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
