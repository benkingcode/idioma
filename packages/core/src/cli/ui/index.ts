/**
 * CLI UI helpers for consistent terminal output.
 *
 * - Spinners: For indeterminate progress (extract, compile)
 * - Animated header: The globe and progress for translate
 * - Automatic CI detection with fallback to simple text output
 */

export {
  isInteractive,
  setNonInteractive,
  resetNonInteractive,
} from './env.js';

export {
  createSpinner,
  type Spinner,
  InteractiveSpinner,
  SimpleSpinner,
} from './spinner.js';

export { displayGlobe, getGlobeFrames, GLOBE_HEIGHT } from './globe.js';

export {
  createAnimatedHeader,
  type AnimatedHeader,
  type AnimatedHeaderOptions,
  InteractiveAnimatedHeader,
  SimpleAnimatedHeader,
} from './animated-header.js';

export {
  colors,
  getColors,
  getColorTheme,
  getCachedColorTheme,
  resetColorsCache,
  resetThemeCache,
  type ColorTheme,
} from './theme.js';
