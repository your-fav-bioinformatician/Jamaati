// Article list: GET /articles?lang (api/articles.py). The filter lives in the
// URL (?q=), so going back from an article returns to the same list.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getArticles } from '../api/client';
import { useDebounced, useFetch } from '../api/useFetch';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, FieldInput, Icon } from '../theme/widgets';
import { EmptyState, Fetched, PageHeader } from '../shared/Status';
import { ROUTES } from '../paths';
import { articleNumber, excerpt, sortArticles } from './articleUtils';
import { useSyncedParam } from '../shared/useSyncedParam';
import '../shared/page.css';
import './articles.css';

export default function ArticlesScreen() {
  const { s, lang } = useLang();
  const a = s.articles;
  const result = useFetch(() => getArticles(lang), lang);
  const [filter, setFilter] = useSyncedParam('q');

  return (
    <div className="page">
      <div className="page__inner">
        <PageHeader title={a.title} subtitle={a.subtitle} />
        <div className="articles__filter">
          <label className="visually-hidden" htmlFor="articles-filter">
            {a.filter}
          </label>
          <FieldInput id="articles-filter" type="search" placeholder={a.filterPlaceholder} value={filter} onChange={setFilter} suffix={<Icon name="search" size="20px" />} />
        </div>
        <Fetched result={result}>{(list) => <ArticleList list={list} filter={filter} />}</Fetched>
      </div>
    </div>
  );
}

function ArticleList({ list, filter }) {
  const { s, num } = useLang();
  const words = useDebounced(filter, 200).toLowerCase().split(/\s+/).filter(Boolean);
  const shown = useMemo(() => {
    const sorted = sortArticles(list);
    if (!words.length) return sorted;
    return sorted.filter((art) => {
      const text = `${art.title} ${art.body}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [list, words.join(' ')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shown.length) return <EmptyState title={s.articles.empty} />;

  return (
    <ul className="card-grid">
      {shown.map((art) => (
        <li key={art.id}>
          <Link to={ROUTES.article(art.id)} className="card-link">
            <AppCard padding={`${hp(2.6)} ${wp(2.6)}`} className="article-card">
              <span className="article-card__number" aria-hidden="true" style={AppText.display({ percent: 2.2, min: 15, max: 20, color: null })}>
                {num(Number(articleNumber(art.id) ?? 0))}
              </span>
              <div className="article-card__text">
                <h2 style={AppText.display({ percent: 2.3, min: 16, max: 20 })}>{art.title}</h2>
                <p className="clamp-3" style={{ ...AppText.body({ percent: 1.6, color: 'var(--color-primary)' }), marginTop: hp(0.8) }}>
                  {excerpt(art.body)}
                </p>
              </div>
            </AppCard>
          </Link>
        </li>
      ))}
    </ul>
  );
}
