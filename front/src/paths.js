// Route paths, shared by routes.jsx and the screens.

export const ROUTES = {
  landing: '/',
  intake: (step = 1) => `/quiz/intake/${step}`,
  preparing: '/quiz/preparing',
  quiz: '/quiz',
  analyzing: '/quiz/analyzing',
  results: '/results',
  feedback: '/feedback',
  articles: '/articles',
  article: (id) => `/articles/${encodeURIComponent(id)}`,
  catalog: '/catalog',
  career: (id) => `/catalog/${encodeURIComponent(id)}`,
  search: '/search',
  major: (id) => `/majors/${encodeURIComponent(id)}`,
};

/** Where the in-app back button goes when there is no history to go back to. */
export function parentOf(pathname) {
  const step = /^\/quiz\/intake\/(\d+)$/.exec(pathname);
  if (step && Number(step[1]) > 1) return ROUTES.intake(Number(step[1]) - 1);
  if (pathname === ROUTES.feedback) return ROUTES.results;
  if (pathname.startsWith('/articles/')) return ROUTES.articles;
  if (pathname.startsWith('/catalog/')) return ROUTES.catalog;
  if (pathname.startsWith('/majors/')) return ROUTES.search;
  return ROUTES.landing;
}

/** Where a session's quiz should resume. */
export function quizEntryFor(session) {
  if (session.results) return ROUTES.results;
  if (session.userId && session.done) return ROUTES.analyzing;
  if (session.userId) return ROUTES.quiz;
  return ROUTES.intake(1);
}
