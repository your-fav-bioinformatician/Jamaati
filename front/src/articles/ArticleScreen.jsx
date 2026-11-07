// One article. Bodies are markdown, rendered without raw HTML (react-markdown
// ignores it), so article content can't inject markup or scripts.
//
// Articles are separate documents per language (`en-06-…` / `ar-06-…`):
// after a language switch, this page moves to the translation of the
// article being read.
import { Link, Navigate, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { getArticles } from '../api/client';
import { useFetch } from '../api/useFetch';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard } from '../theme/widgets';
import { ErrorState, Fetched } from '../shared/Status';
import { ROUTES } from '../paths';
import { counterpartOf, sortArticles } from './articleUtils';
import '../shared/page.css';
import './articles.css';

const isExternal = (href) => /^https?:\/\//i.test(href ?? '');

// Markdown elements → themed elements. Headings shift down one level: the
// article title is the page's h1.
const MARKDOWN_COMPONENTS = {
  h1: ({ children }) => <h2>{children}</h2>,
  h2: ({ children }) => <h2>{children}</h2>,
  h3: ({ children }) => <h3>{children}</h3>,
  a: ({ href, children }) =>
    isExternal(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ) : (
      <a href={href}>{children}</a>
    ),
};

export default function ArticleScreen() {
  const { id } = useParams();
  const { lang } = useLang();
  const result = useFetch(() => getArticles(lang), lang);

  return (
    <div className="page">
      <div className="page__inner page__inner--narrow">
        <Fetched result={result}>{(list) => <ArticleView id={id} list={list} />}</Fetched>
      </div>
    </div>
  );
}

function ArticleView({ id, list }) {
  const { s } = useLang();
  const article = list.find((a) => a.id === id);

  if (!article) {
    // Probably the other language's id after a language switch.
    const translation = counterpartOf(id, list);
    if (translation) return <Navigate to={ROUTES.article(translation.id)} replace />;
    return <ErrorState message={s.articles.notFound} />;
  }

  const related = sortArticles(list.filter((a) => article.related_articles?.includes(a.id)));

  return (
    <>
      <AppCard as="article" padding={`${hp(4)} ${wp(4)}`}>
        <h1 style={AppText.display({ percent: 3.4, min: 20, max: 30 })}>{article.title}</h1>
        <div className="prose" style={{ ...AppText.body({ percent: 1.9, height: 1.8 }), marginTop: hp(2) }}>
          <Markdown components={MARKDOWN_COMPONENTS}>{article.body ?? ''}</Markdown>
        </div>
      </AppCard>

      {related.length > 0 && (
        <nav aria-labelledby="related-title">
          <h2 id="related-title" className="section-title" style={AppText.display({ percent: 2.4, min: 16, max: 20 })}>
            {s.articles.related}
          </h2>
          <ul className="related-list">
            {related.map((a) => (
              <li key={a.id}>
                <Link to={ROUTES.article(a.id)} className="related-link" style={AppText.body({ percent: 1.8, weight: 600, color: null })}>
                  {a.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
