import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectLocaleFromBrowser,
  detectLocaleFromHeaders,
  type DetectionContext,
} from './detection.js';

describe('detectLocaleFromHeaders', () => {
  const ctx: DetectionContext<'en' | 'es' | 'fr'> = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    order: ['cookie', 'header'],
    cookieName: 'IDIOMI_LOCALE',
    algorithm: 'best fit',
  };

  it('should detect locale from cookie header', () => {
    const result = detectLocaleFromHeaders('IDIOMI_LOCALE=es', null, ctx);
    expect(result).toBe('es');
  });

  it('should detect locale from Accept-Language header', () => {
    const result = detectLocaleFromHeaders(null, 'fr-FR,fr;q=0.9', ctx);
    expect(result).toBe('fr');
  });

  it('should return defaultLocale when no match', () => {
    const result = detectLocaleFromHeaders(null, 'de-DE', ctx);
    expect(result).toBe('en');
  });

  it('should prefer cookie over header when order is [cookie, header]', () => {
    const result = detectLocaleFromHeaders('IDIOMI_LOCALE=es', 'fr-FR', ctx);
    expect(result).toBe('es');
  });

  it('should prefer header over cookie when order is [header, cookie]', () => {
    const ctxHeaderFirst: DetectionContext<'en' | 'es' | 'fr'> = {
      ...ctx,
      order: ['header', 'cookie'],
    };
    const result = detectLocaleFromHeaders(
      'IDIOMI_LOCALE=es',
      'fr-FR',
      ctxHeaderFirst,
    );
    expect(result).toBe('fr');
  });

  it('should ignore invalid locale in cookie', () => {
    const result = detectLocaleFromHeaders('IDIOMI_LOCALE=de', 'es-ES', ctx);
    expect(result).toBe('es');
  });

  it('should handle BCP 47 language matching', () => {
    const result = detectLocaleFromHeaders(null, 'es-MX,es;q=0.9', ctx);
    expect(result).toBe('es');
  });

  it('should return defaultLocale when both cookie and header are null', () => {
    const result = detectLocaleFromHeaders(null, null, ctx);
    expect(result).toBe('en');
  });
});

describe('detectLocaleFromBrowser', () => {
  const ctx: DetectionContext<'en' | 'es' | 'fr'> = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    order: ['cookie', 'header'],
    cookieName: 'IDIOMI_LOCALE',
    algorithm: 'best fit',
  };

  // Store original globals
  const originalDocument = global.document;
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // Reset mocks
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Restore original globals
    if (originalDocument) {
      Object.defineProperty(global, 'document', {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    }
    if (originalNavigator) {
      Object.defineProperty(global, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it('should detect locale from document.cookie', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: 'IDIOMI_LOCALE=es; other=value' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { languages: [] },
      writable: true,
      configurable: true,
    });

    const result = detectLocaleFromBrowser(ctx);
    expect(result).toBe('es');
  });

  it('should detect locale from navigator.languages', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { languages: ['fr-FR', 'fr', 'en'] },
      writable: true,
      configurable: true,
    });

    const result = detectLocaleFromBrowser(ctx);
    expect(result).toBe('fr');
  });

  it('should prefer cookie over navigator.languages', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: 'IDIOMI_LOCALE=es' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { languages: ['fr-FR'] },
      writable: true,
      configurable: true,
    });

    const result = detectLocaleFromBrowser(ctx);
    expect(result).toBe('es');
  });

  it('should return defaultLocale when no match', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: '' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { languages: ['de-DE'] },
      writable: true,
      configurable: true,
    });

    const result = detectLocaleFromBrowser(ctx);
    expect(result).toBe('en');
  });

  it('should handle missing document gracefully', () => {
    Object.defineProperty(global, 'document', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: { languages: ['es-ES'] },
      writable: true,
      configurable: true,
    });

    const result = detectLocaleFromBrowser(ctx);
    expect(result).toBe('es');
  });

  it('should handle missing navigator gracefully', () => {
    Object.defineProperty(global, 'document', {
      value: { cookie: 'IDIOMI_LOCALE=fr' },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'navigator', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const result = detectLocaleFromBrowser(ctx);
    expect(result).toBe('fr');
  });

  describe('BCP 47 matching with algorithm option', () => {
    it('should match en-GB to en-US with best fit algorithm', () => {
      // This tests that 'best fit' uses language distance matching
      // en-GB should match en-US since they're both English variants
      const ctxWithEnUS: DetectionContext<'en-US' | 'de'> = {
        locales: ['en-US', 'de'],
        defaultLocale: 'de',
        order: ['header'],
        cookieName: 'IDIOMI_LOCALE',
        algorithm: 'best fit',
      };

      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['en-GB'] },
        writable: true,
        configurable: true,
      });

      const result = detectLocaleFromBrowser(ctxWithEnUS);
      expect(result).toBe('en-US');
    });

    it('should NOT match en-GB to en-US with lookup algorithm', () => {
      // This tests that 'lookup' uses strict matching
      // en-GB should NOT match en-US with strict RFC 4647 lookup
      const ctxLookup: DetectionContext<'en-US' | 'de'> = {
        locales: ['en-US', 'de'],
        defaultLocale: 'de',
        order: ['header'],
        cookieName: 'IDIOMI_LOCALE',
        algorithm: 'lookup',
      };

      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['en-GB'] },
        writable: true,
        configurable: true,
      });

      const result = detectLocaleFromBrowser(ctxLookup);
      // With strict lookup, en-GB doesn't match en-US, so falls back to default
      expect(result).toBe('de');
    });

    it('should match es-MX to es with best fit algorithm', () => {
      // Verify BCP 47 matching works for regional variants
      Object.defineProperty(global, 'document', {
        value: { cookie: '' },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global, 'navigator', {
        value: { languages: ['es-MX'] },
        writable: true,
        configurable: true,
      });

      const result = detectLocaleFromBrowser(ctx);
      expect(result).toBe('es');
    });
  });
});
