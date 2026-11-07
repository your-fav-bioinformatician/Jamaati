// Port of lib/responsive.dart. Flutter computes pixel values from
// MediaQuery; on the web the browser does that for us via viewport units,
// so these helpers return CSS length strings for use in `style` props.

/** [percent] of the viewport width, e.g. wp(4) ≈ 4% of the width. */
export const wp = (percent) => `${percent}vw`;

/** [percent] of the viewport height. */
export const hp = (percent) => `${percent}vh`;

/**
 * Font/icon size as a percentage of the shortest viewport side, clamped so
 * text stays readable on very small or very large screens.
 */
export const sp = (percent, min = 10, max = 56) => `clamp(${min}px, ${percent}vmin, ${max}px)`;

/** wp(percent) clamped between [min] and [max] px, like `context.wp(x).clamp(a, b)`. */
export const wpClamp = (percent, min, max) => `clamp(${min}px, ${percent}vw, ${max}px)`;

/** hp(percent) clamped between [min] and [max] px, like `context.hp(x).clamp(a, b)`. */
export const hpClamp = (percent, min, max) => `clamp(${min}px, ${percent}vh, ${max}px)`;

/** Width at which layouts switch from stacked to side-by-side (`isWide`). */
export const WIDE_BREAKPOINT = 860;
