import chalk from 'chalk';

export type ColorTheme = 'light' | 'dark';

/**
 * Detect whether the terminal has a light or dark background.
 *
 * Detection priority:
 * 1. IDIOMI_COLOR_THEME env var (explicit user preference)
 * 2. COLORFGBG env var (set by iTerm2, Konsole, rxvt-unicode)
 * 3. Default to 'dark' (most common for developers)
 *
 * Note: Terminal background detection is notoriously unreliable because
 * terminals are fundamentally one-way communication - they render output
 * but rarely expose their configuration. COLORFGBG is the closest thing
 * to a standard, but only a handful of terminals set it.
 */
export function getColorTheme(): ColorTheme {
  // 1. Explicit user preference via env var
  const explicit = process.env.IDIOMI_COLOR_THEME?.toLowerCase();
  if (explicit === 'light') return 'light';
  if (explicit === 'dark') return 'dark';

  // 2. COLORFGBG detection
  // Format: "foreground;background" where values are color indices (0-15)
  // Common values:
  //   "0;15" or "0;default" = dark text on light background (light theme)
  //   "15;0" or "default;0" = light text on dark background (dark theme)
  // Colors 0-6 are typically dark, 7-15 are typically light
  const colorfgbg = process.env.COLORFGBG;
  if (colorfgbg) {
    const parts = colorfgbg.split(';');
    const bgPart = parts[parts.length - 1];
    if (bgPart && bgPart !== 'default') {
      const bg = parseInt(bgPart, 10);
      // Background color index >= 7 indicates light background
      // (7 = white/light gray in standard 16-color palette)
      if (!isNaN(bg) && bg >= 7) {
        return 'light';
      }
    }
  }

  // 3. Default to dark (most common developer setup)
  return 'dark';
}

// Cache theme detection (doesn't change during process lifetime)
let cachedTheme: ColorTheme | null = null;

/**
 * Get the cached color theme (cached for performance).
 * Theme is detected once at first call and cached thereafter.
 */
export function getCachedColorTheme(): ColorTheme {
  if (cachedTheme === null) {
    cachedTheme = getColorTheme();
  }
  return cachedTheme;
}

/**
 * Reset the cached theme (mainly for testing).
 */
export function resetThemeCache(): void {
  cachedTheme = null;
}

/**
 * Adaptive color palette that adjusts based on terminal background.
 *
 * These colors are chosen to be readable on both light and dark backgrounds,
 * with specific adjustments for problematic colors like cyan.
 */
export function getColors() {
  const theme = getCachedColorTheme();

  return {
    // Primary accent color - cyan is hard to read on light backgrounds
    primary: theme === 'light' ? chalk.blue : chalk.cyan,
    primaryBold: theme === 'light' ? chalk.bold.black : chalk.bold.cyan,

    // Success color - green works on both, but adjust shade
    success: chalk.green,

    // Error color - red works on both
    error: chalk.red,

    // Warning - yellow can be hard on light backgrounds
    warning: theme === 'light' ? chalk.rgb(184, 134, 11) : chalk.yellow,

    // Dim/secondary text
    dim: theme === 'light' ? chalk.gray : chalk.dim,

    // Info messages
    info: theme === 'light' ? chalk.blue : chalk.cyan,

    // For the globe/earth visualization
    ocean: theme === 'light' ? chalk.gray.dim : chalk.cyan.dim,
    ice: theme === 'light' ? chalk.gray : chalk.cyan,
    land: theme === 'light' ? chalk.bold.black : chalk.bold.greenBright,

    // Theme info for debugging
    theme,
  };
}

// Export singleton colors instance (lazy evaluated)
let colorsInstance: ReturnType<typeof getColors> | null = null;

/**
 * Get the colors instance (cached for performance).
 */
export function colors(): ReturnType<typeof getColors> {
  if (colorsInstance === null) {
    colorsInstance = getColors();
  }
  return colorsInstance;
}

/**
 * Reset colors cache (mainly for testing).
 */
export function resetColorsCache(): void {
  colorsInstance = null;
  resetThemeCache();
}
