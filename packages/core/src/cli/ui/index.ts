/**
 * CLI UI helpers for consistent terminal output.
 *
 * - Spinners: For indeterminate progress (extract, compile)
 * - Progress bars: For determinate progress (translate)
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

export {
  createProgressBar,
  type ProgressBar,
  type ProgressBarOptions,
  InteractiveProgressBar,
  SimpleProgressBar,
} from './progress.js';

export { displayGlobe, getGlobeFrames, GLOBE_HEIGHT } from './globe.js';
