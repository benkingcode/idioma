import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  colors,
  getColorTheme,
  resetColorsCache,
  type ColorTheme,
} from './theme.js';

describe('theme detection', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset module cache before each test
    resetColorsCache();
    // Clone env to avoid mutation
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetColorsCache();
  });

  describe('getColorTheme', () => {
    it('returns dark by default when no env vars are set', () => {
      delete process.env.IDIOMA_COLOR_THEME;
      delete process.env.COLORFGBG;

      expect(getColorTheme()).toBe('dark');
    });

    it('respects explicit IDIOMA_COLOR_THEME=light', () => {
      process.env.IDIOMA_COLOR_THEME = 'light';

      expect(getColorTheme()).toBe('light');
    });

    it('respects explicit IDIOMA_COLOR_THEME=dark', () => {
      process.env.IDIOMA_COLOR_THEME = 'dark';

      expect(getColorTheme()).toBe('dark');
    });

    it('handles case-insensitive IDIOMA_COLOR_THEME', () => {
      process.env.IDIOMA_COLOR_THEME = 'LIGHT';
      expect(getColorTheme()).toBe('light');

      process.env.IDIOMA_COLOR_THEME = 'Dark';
      expect(getColorTheme()).toBe('dark');
    });

    it('IDIOMA_COLOR_THEME takes precedence over COLORFGBG', () => {
      process.env.IDIOMA_COLOR_THEME = 'dark';
      process.env.COLORFGBG = '0;15'; // Would indicate light

      expect(getColorTheme()).toBe('dark');
    });

    describe('COLORFGBG detection', () => {
      beforeEach(() => {
        delete process.env.IDIOMA_COLOR_THEME;
      });

      it('detects light theme from COLORFGBG=0;15', () => {
        process.env.COLORFGBG = '0;15';

        expect(getColorTheme()).toBe('light');
      });

      it('detects light theme from COLORFGBG=0;7', () => {
        // 7 is the threshold (white/light gray)
        process.env.COLORFGBG = '0;7';

        expect(getColorTheme()).toBe('light');
      });

      it('detects dark theme from COLORFGBG=15;0', () => {
        process.env.COLORFGBG = '15;0';

        expect(getColorTheme()).toBe('dark');
      });

      it('detects dark theme from COLORFGBG=7;0', () => {
        process.env.COLORFGBG = '7;0';

        expect(getColorTheme()).toBe('dark');
      });

      it('handles three-part COLORFGBG format (fg;bg;extra)', () => {
        // Some terminals use three values
        process.env.COLORFGBG = '0;15;0';

        // Should use the last part (0) as background
        expect(getColorTheme()).toBe('dark');
      });

      it('handles COLORFGBG with "default" value', () => {
        process.env.COLORFGBG = '0;default';

        // "default" is not a number, should fall back to dark
        expect(getColorTheme()).toBe('dark');
      });

      it('defaults to dark for invalid COLORFGBG values', () => {
        process.env.COLORFGBG = 'invalid';

        expect(getColorTheme()).toBe('dark');
      });
    });
  });

  describe('colors', () => {
    it('returns different primary color for light vs dark theme', () => {
      process.env.IDIOMA_COLOR_THEME = 'dark';
      resetColorsCache();
      const darkColors = colors();

      process.env.IDIOMA_COLOR_THEME = 'light';
      resetColorsCache();
      const lightColors = colors();

      // The actual chalk functions will be different
      expect(darkColors.primary).not.toBe(lightColors.primary);
      expect(darkColors.theme).toBe('dark');
      expect(lightColors.theme).toBe('light');
    });

    it('caches colors for performance', () => {
      process.env.IDIOMA_COLOR_THEME = 'dark';
      resetColorsCache();

      const first = colors();
      const second = colors();

      expect(first).toBe(second);
    });

    it('provides all expected color functions', () => {
      const c = colors();

      expect(typeof c.primary).toBe('function');
      expect(typeof c.primaryBold).toBe('function');
      expect(typeof c.success).toBe('function');
      expect(typeof c.error).toBe('function');
      expect(typeof c.warning).toBe('function');
      expect(typeof c.dim).toBe('function');
      expect(typeof c.info).toBe('function');
      expect(typeof c.ocean).toBe('function');
      expect(typeof c.ice).toBe('function');
      expect(typeof c.land).toBe('function');
    });
  });
});
