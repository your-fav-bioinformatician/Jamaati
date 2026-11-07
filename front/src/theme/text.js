// Port of lib/theme/text_styles.dart. Returns style objects; sizes are
// derived from sp() (a percentage of the shortest viewport side), never
// fixed point sizes. Default colours are theme variables, so text adapts to
// dark mode automatically. Pass `color: null` to set no colour at all and
// let a CSS class decide it (buttons, chips): an inline colour, even
// 'inherit', would override the class.
import { sp } from './responsive';

export const AppText = {
  /** Display / heading font (Lalezar). */
  display({ percent = 4.4, color = 'var(--color-accent)', min = 18, max = 40 } = {}) {
    return {
      fontFamily: 'var(--font-display)',
      fontWeight: 400,
      fontSize: sp(percent, min, max),
      ...(color !== null && { color }),
      lineHeight: 1.15,
    };
  },

  /** Body font (IBM Plex Sans Arabic). */
  body({ percent = 2.0, color = 'var(--color-text)', min = 12, max = 20, height = 1.5, weight } = {}) {
    return {
      fontFamily: 'var(--font-body)',
      fontSize: sp(percent, min, max),
      ...(color !== null && { color }),
      lineHeight: height,
      ...(weight !== undefined && { fontWeight: weight }),
    };
  },
};
