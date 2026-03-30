import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setLocale } from './locale.js';

// Mock next/headers
const mockSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockSet })),
}));

describe('setLocale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('sets locale cookie with default name', async () => {
      await setLocale('es');

      expect(mockSet).toHaveBeenCalledWith('IDIOMI_LOCALE', 'es', {
        path: '/',
        maxAge: 31536000, // 1 year
        sameSite: 'lax',
      });
    });

    it('sets locale cookie with custom name', async () => {
      await setLocale('fr', { cookieName: 'MY_LOCALE' });

      expect(mockSet).toHaveBeenCalledWith('MY_LOCALE', 'fr', {
        path: '/',
        maxAge: 31536000,
        sameSite: 'lax',
      });
    });
  });

  describe('cookie options', () => {
    it('sets path to root', async () => {
      await setLocale('de');

      const options = mockSet.mock.calls[0][2];
      expect(options.path).toBe('/');
    });

    it('sets maxAge to 1 year', async () => {
      await setLocale('de');

      const options = mockSet.mock.calls[0][2];
      expect(options.maxAge).toBe(31536000); // 60 * 60 * 24 * 365
    });

    it('sets sameSite to lax for CSRF protection', async () => {
      await setLocale('de');

      const options = mockSet.mock.calls[0][2];
      expect(options.sameSite).toBe('lax');
    });
  });

  describe('multiple calls', () => {
    it('can be called multiple times with different locales', async () => {
      await setLocale('en');
      await setLocale('es');
      await setLocale('fr');

      expect(mockSet).toHaveBeenCalledTimes(3);
      expect(mockSet).toHaveBeenNthCalledWith(
        1,
        'IDIOMI_LOCALE',
        'en',
        expect.any(Object),
      );
      expect(mockSet).toHaveBeenNthCalledWith(
        2,
        'IDIOMI_LOCALE',
        'es',
        expect.any(Object),
      );
      expect(mockSet).toHaveBeenNthCalledWith(
        3,
        'IDIOMI_LOCALE',
        'fr',
        expect.any(Object),
      );
    });
  });

  describe('edge cases', () => {
    it('handles empty locale string', async () => {
      await setLocale('');

      expect(mockSet).toHaveBeenCalledWith(
        'IDIOMI_LOCALE',
        '',
        expect.any(Object),
      );
    });

    it('handles locale with region code', async () => {
      await setLocale('en-US');

      expect(mockSet).toHaveBeenCalledWith(
        'IDIOMI_LOCALE',
        'en-US',
        expect.any(Object),
      );
    });
  });
});
