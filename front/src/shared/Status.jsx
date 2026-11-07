// Loading / error / empty states shared by the content screens.
import { useLang } from '../i18n/LangProvider';
import { AppText } from '../theme/text';
import { hp } from '../theme/responsive';
import { Icon, PrimaryButton } from '../theme/widgets';
import './page.css';

export function Loading({ label }) {
  const { s } = useLang();
  return (
    <div className="status" role="status">
      <span className="spinner" aria-hidden="true" />
      <p style={{ ...AppText.body({ percent: 1.8, color: 'var(--color-primary)' }), marginTop: hp(2) }}>{label ?? s.common.loading}</p>
    </div>
  );
}

export function ErrorState({ onRetry, message }) {
  const { s } = useLang();
  return (
    <div className="status" role="alert">
      <Icon name="error" filled={false} size="40px" color="var(--color-accent)" />
      <p style={{ ...AppText.display({ percent: 2.2, min: 15, max: 20 }), marginTop: hp(1.6) }}>{message ?? s.common.error}</p>
      {onRetry && (
        <div style={{ marginTop: hp(2.4) }}>
          <PrimaryButton label={s.common.retry} onClick={onRetry} />
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon = 'search_off', title, children }) {
  return (
    <div className="status">
      <Icon name={icon} size="40px" color="var(--color-primary)" />
      <p style={{ ...AppText.display({ percent: 2.2, min: 15, max: 20 }), marginTop: hp(1.6) }}>{title}</p>
      {children}
    </div>
  );
}

/** Renders loading / error states of a useFetch result, else `children(data)`. */
export function Fetched({ result, children, loadingLabel }) {
  if (result.status === 'error') return <ErrorState onRetry={result.retry} />;
  if (result.status !== 'ready') return <Loading label={loadingLabel} />;
  return children(result.data);
}

/** Title + subtitle at the top of a content screen. */
export function PageHeader({ title, subtitle, children }) {
  return (
    <header className="page-header">
      <h1 style={AppText.display({ percent: 3.6, min: 20, max: 30 })}>{title}</h1>
      {subtitle && <p style={{ ...AppText.body({ percent: 1.9, color: 'var(--color-primary)' }), marginTop: hp(0.8) }}>{subtitle}</p>}
      {children}
    </header>
  );
}
