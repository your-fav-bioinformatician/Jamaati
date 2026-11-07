// Careers catalog list (api/catalog.py). Search text (?q=) and field
// (?branch=) live in the URL, so back from a career returns to the same list.
//   no filter      → GET  /catalog/titles
//   field only     → POST /catalog/branch
//   search (+field)→ POST /catalog/search, then narrowed to the field
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getCatalogBranch, getCatalogBranches, getCatalogTitles, searchCatalog } from '../api/client';
import { useFetch } from '../api/useFetch';
import { fill } from '../i18n';
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp, wp } from '../theme/responsive';
import { AppCard, AppChip, FieldInput, Icon } from '../theme/widgets';
import { EmptyState, Fetched, PageHeader } from '../shared/Status';
import { useSyncedParam } from '../shared/useSyncedParam';
import { ROUTES } from '../paths';
import '../shared/page.css';
import './catalog.css';

export default function CatalogScreen() {
  const { s, lang, num } = useLang();
  const c = s.catalog;
  const [params, setParams] = useSearchParams();
  const [text, setText, query] = useSyncedParam('q');
  const branch = params.get('branch') ?? '';
  const trimmed = query.trim();

  const branches = useFetch(() => getCatalogBranches(lang), lang);
  const result = useFetch(
    async (signal) => {
      if (trimmed) {
        const docs = await searchCatalog(trimmed, lang, signal);
        return branch ? docs.filter((d) => d.branch === branch) : docs;
      }
      if (branch) return getCatalogBranch(branch, lang, signal);
      return getCatalogTitles(lang);
    },
    `${trimmed}|${branch}|${lang}`,
  );

  const setBranch = (value) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set('branch', value);
        else next.delete('branch');
        return next;
      },
      { replace: true },
    );

  // After a language switch the ?branch= is in the other language. The
  // backend still matches it; rename it to the new language's name (taken
  // from the results) so the right field chip is highlighted.
  useEffect(() => {
    if (!branch || branches.status !== 'ready' || branches.data.includes(branch)) return;
    const renamed = result.status === 'ready' && result.data[0]?.branch;
    if (renamed && renamed !== branch && branches.data.includes(renamed)) setBranch(renamed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, branches.status, branches.data, result.status, result.data]);

  return (
    <div className="page">
      <div className="page__inner">
        <PageHeader title={c.title} subtitle={c.subtitle} />

        <div className="catalog__search">
          <label className="visually-hidden" htmlFor="catalog-search">
            {c.search}
          </label>
          <FieldInput id="catalog-search" type="search" placeholder={c.searchPlaceholder} value={text} onChange={setText} suffix={<Icon name="search" size="20px" />} />
        </div>

        {branches.status === 'ready' && (
          <div className="catalog__branches" role="group" aria-label={c.branches}>
            {['', ...branches.data].map((name) => (
              <button
                key={name || 'all'}
                type="button"
                className={`branch-chip${branch === name ? ' is-selected' : ''}`}
                aria-pressed={branch === name}
                onClick={() => setBranch(name)}
                style={AppText.body({ percent: 1.5, weight: 600, color: null, height: 1.2 })}
              >
                {name || c.allBranches}
              </button>
            ))}
          </div>
        )}

        <Fetched result={result}>
          {(docs) =>
            docs.length ? (
              <>
                <p className="count-line" style={AppText.body({ percent: 1.6, color: 'var(--color-primary)' })} aria-live="polite">
                  {fill(c.count, { n: num(docs.length) })}
                </p>
                <ul className="card-grid">
                  {docs.map((doc) => (
                    <li key={doc.id}>
                      <CareerCard career={doc} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState title={c.empty} />
            )
          }
        </Fetched>
      </div>
    </div>
  );
}

function CareerCard({ career }) {
  const { s, num } = useLang();
  const c = s.catalog;
  return (
    <Link to={ROUTES.career(career.id)} className="card-link">
      <AppCard padding={`${hp(2.4)} ${wp(2.6)}`}>
        <h2 style={AppText.display({ percent: 2.4, min: 16, max: 21 })}>{career.name}</h2>
        <div className="chip-row" style={{ marginTop: hp(1) }}>
          {career.branch && <AppChip label={career.branch} fontPercent={1.4} />}
          {career.stability && <AppChip label={career.stability} variant="secondary" fontPercent={1.4} />}
        </div>
        {typeof career.salary === 'number' && (
          <p style={{ ...AppText.body({ percent: 1.6, color: 'var(--color-primary)' }), marginTop: hp(1) }}>
            {fill(c.avgSalary, { amount: fill(s.common.iqd, { amount: num(career.salary) }) })}
          </p>
        )}
      </AppCard>
    </Link>
  );
}
