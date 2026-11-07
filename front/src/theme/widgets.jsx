// Port of lib/theme/widgets.dart. Colours come only from tokens.css
// variables (see widgets.css), so every widget follows the active theme.
import { useState } from 'react';
import { AppText } from './text';
import { hp, sp, wp } from './responsive';
import { useTheme } from './ThemeProvider';
import { useLang } from '../i18n/LangProvider';
import { optionLabel } from '../i18n/options';
import './widgets.css';

const cx = (...names) => names.filter(Boolean).join(' ');

/** Surface-coloured rounded panel, ports `AppCard`. */
export function AppCard({ children, padding, borderColor, style, className, as: Tag = 'div' }) {
  return (
    <Tag
      className={cx('app-card', className)}
      style={{
        padding: padding ?? `${hp(3)} ${wp(3.4)}`,
        ...(borderColor && { borderColor }),
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

/**
 * Grows slightly while the pointer is over it, ports `HoverLift`.
 * `children` is a render function receiving `hovering`, like the Flutter
 * `builder`. Inert on touch devices.
 */
export function HoverLift({ children, scale = 1.02, className }) {
  const [hovering, setHovering] = useState(false);
  return (
    <div
      className={className}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        transform: `scale(${hovering ? scale : 1})`,
        transition: 'transform var(--duration-fast) ease-out',
      }}
    >
      {children(hovering)}
    </div>
  );
}

/**
 * Rounded Material icon (web equivalent of `Icons.<name>_rounded`).
 * `filled={false}` gives the outlined variant (`Icons.<name>_outline`).
 * `mirror` flips it in right-to-left layouts (for arrows).
 */
export function Icon({ name, size, color = 'currentColor', filled = true, mirror = false }) {
  return (
    <span
      className={cx('material-symbols-rounded', mirror && 'icon-mirror')}
      aria-hidden="true"
      style={{ fontSize: size, color, fontVariationSettings: `'FILL' ${filled ? 1 : 0}` }}
    >
      {name}
    </span>
  );
}

/** The wordmark bridge icon, ports `BridgeMark`. Expects front/public/logo.svg. */
export function BridgeMark({ size }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}logo.svg`}
      alt=""
      style={{ width: size, height: `calc(${size} * 0.65)`, objectFit: 'contain', display: 'block' }}
    />
  );
}

/** Accent-filled primary button, ports `PrimaryButton`. Disabled when `onClick` is missing. */
export function PrimaryButton({ label, onClick, fullWidth = false, type = 'button' }) {
  return (
    <button
      type={type}
      className={cx('btn', 'btn--primary', fullWidth && 'btn--full')}
      onClick={onClick}
      disabled={!onClick && type !== 'submit'}
      style={AppText.display({ percent: 2.4, color: null, min: 14, max: 18 })}
    >
      {label}
    </button>
  );
}

/** Light, tinted button, ports `SecondaryButton`. */
export function SecondaryButton({ label, onClick, fullWidth = false, disabled = false }) {
  return (
    <button
      type="button"
      className={cx('btn', 'btn--secondary', fullWidth && 'btn--full')}
      onClick={onClick}
      disabled={disabled}
      style={AppText.body({ percent: 1.9, color: null, weight: 600 })}
    >
      {label}
    </button>
  );
}

/** Text-only button, ports `GhostButton`. `visible={false}` keeps its space but hides it. */
export function GhostButton({ label, onClick, fullWidth = false, visible = true }) {
  return (
    <button
      type="button"
      className={cx('btn', 'btn--ghost', fullWidth && 'btn--full', !visible && 'is-invisible')}
      onClick={visible ? onClick : undefined}
      disabled={!visible}
      aria-hidden={!visible || undefined}
      tabIndex={visible ? undefined : -1}
      style={AppText.body({ percent: 1.9, color: null, weight: 600 })}
    >
      {label}
    </button>
  );
}

/** Small pill, ports `AppChip`. */
export function AppChip({ label, variant = 'primary', fontPercent = 1.7 }) {
  return (
    <span
      dir="auto"
      className={cx('chip', variant === 'secondary' && 'chip--secondary')}
      style={AppText.body({ percent: fontPercent, color: null, weight: 600, height: 1.0 })}
    >
      {label}
    </span>
  );
}

/** Label above a form field, ports `FieldLabel`. */
export function FieldLabel({ children, htmlFor, as: Tag = 'label' }) {
  return (
    <Tag
      className="field-label"
      htmlFor={Tag === 'label' ? htmlFor : undefined}
      style={AppText.body({ percent: 1.7, color: 'var(--color-primary)', weight: 600 })}
    >
      {children}
    </Tag>
  );
}

/** Text field (or textarea when `rows` > 1), ports `FieldInput`. */
export function FieldInput({ id, value, onChange, placeholder, type = 'text', rows = 1, inputMode, min, max, suffix }) {
  const style = AppText.body({ percent: 1.9 });
  const common = {
    id,
    className: cx('field', suffix && 'field--with-suffix'),
    value: value ?? '',
    placeholder,
    onChange: (e) => onChange(e.target.value),
    style,
  };
  return (
    <div className="field-wrap">
      {rows > 1 ? <textarea {...common} rows={rows} /> : <input {...common} type={type} inputMode={inputMode} min={min} max={max} />}
      {suffix && <span className="field-suffix">{suffix}</span>}
    </div>
  );
}

/**
 * Dropdown, ports `FieldSelect`. Options are `{ value, en, ar }` objects from
 * i18n/options.js (or `{ en, ar, options: [...] }` groups, shown as
 * <optgroup>s). `value` is an option's wire value or null, so a selection
 * survives a language switch and is never a translated label.
 * `clearable` lets the placeholder be picked again to clear the field (for
 * optional fields and "any" filters).
 */
export function FieldSelect({ id, options, placeholder, value, onChange, clearable = false }) {
  const { lang } = useLang();
  const empty = value === null || value === undefined;
  // <select> values are strings: map them back to the option's own value.
  const byKey = new Map();
  const renderOption = (o) => {
    const key = String(o.value);
    byKey.set(key, o.value);
    return (
      <option key={key} value={key}>
        {optionLabel(o, lang)}
      </option>
    );
  };
  return (
    <div className="field-wrap">
      <select
        id={id}
        className={cx('field', 'field--select', empty && 'is-empty')}
        value={empty ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : byKey.get(e.target.value))}
        style={AppText.body({ percent: 1.9, color: null })}
      >
        <option value="" disabled={!clearable}>
          {placeholder}
        </option>
        {options.map((item) =>
          item.options ? (
            <optgroup key={item.en} label={optionLabel(item, lang)}>
              {item.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(item)
          ),
        )}
      </select>
      <span className="field-suffix">
        <Icon name="keyboard_arrow_down" size={sp(2.6, 16, 24)} color="var(--color-primary)" />
      </span>
    </div>
  );
}

/** Card that highlights when selected, ports `SelectableCard`. */
export function SelectableCard({ children, selected, onClick, padding, className, label }) {
  return (
    <button
      type="button"
      className={cx('selectable-card', selected && 'is-selected', className)}
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      style={{ padding: padding ?? `${hp(2)} ${wp(2.6)}` }}
    >
      {children}
    </button>
  );
}

/** On/off pill switch, ports `ToggleSwitch`. Purely visual: put it inside a button. */
export function ToggleSwitch({ on }) {
  return (
    <span className={cx('toggle', on && 'is-on')} aria-hidden="true">
      <span className="toggle__knob" />
    </span>
  );
}

/**
 * Slide/fade in when `animKey` changes, ports `StepTransition`. Mirrors
 * in right-to-left layouts, so "forward" always comes from the reading end.
 */
export function StepTransition({ animKey, forward = true, children }) {
  const { isRtl } = useLang();
  const offset = (forward ? 6 : -6) * (isRtl ? -1 : 1);
  return (
    <div key={animKey} className="step-transition" style={{ '--step-offset': `${offset}%` }}>
      {children}
    </div>
  );
}

/** Round icon button used in the top nav. */
export function IconButton({ icon, label, onClick, mirror = false }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} size={sp(3, 18, 24)} mirror={mirror} />
    </button>
  );
}

/** Light/dark switch. Rendered in the top nav so every screen has it. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { s } = useLang();
  const isDark = theme === 'dark';
  return (
    <IconButton icon={isDark ? 'light_mode' : 'dark_mode'} label={isDark ? s.theme.toLight : s.theme.toDark} onClick={toggleTheme} />
  );
}
