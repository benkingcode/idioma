/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
// Import after mocks
import { createLocaleHead } from './LocaleHead.js';

// Mock next/navigation (needed for module resolution)
vi.mock('next/navigation', () => ({
  usePathname: () => '/about',
}));

describe('createLocaleHead (App Router)', () => {
  const config = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    metadataBase: 'https://example.com',
  };

  afterEach(() => {
    cleanup();
    document.head.querySelectorAll('link').forEach((link) => link.remove());
  });

  describe('basic rendering', () => {
    it('renders canonical link', () => {
      const LocaleHead = createLocaleHead(config);
      // Use explicit props (simulates server component usage)
      render(<LocaleHead pathname="/about" locale="en" />);

      const canonical = document.head.querySelector('link[rel="canonical"]');
      expect(canonical).toBeTruthy();
      expect(canonical?.getAttribute('href')).toContain('example.com');
    });

    it('renders hreflang links for all locales', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/about" locale="en" />);

      const alternates = document.head.querySelectorAll(
        'link[rel="alternate"]',
      );
      expect(alternates).toHaveLength(4); // 3 locales + x-default
    });

    it('includes x-default link', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/about" locale="en" />);

      const xDefault = document.head.querySelector(
        'link[hreflang="x-default"]',
      );
      expect(xDefault).toBeTruthy();
    });

    it('renders hreflang for each locale', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/about" locale="en" />);

      expect(document.head.querySelector('link[hreflang="en"]')).toBeTruthy();
      expect(document.head.querySelector('link[hreflang="es"]')).toBeTruthy();
      expect(document.head.querySelector('link[hreflang="fr"]')).toBeTruthy();
    });
  });

  describe('with explicit props', () => {
    it('uses pathname prop', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/contact" locale="en" />);

      const canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      expect(canonical.getAttribute('href')).toContain('/contact');
    });

    it('uses locale prop', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/about" locale="es" />);

      const canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      expect(canonical.getAttribute('href')).toContain('/es/');
    });

    it('uses both props together', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/blog" locale="fr" />);

      const canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      expect(canonical.getAttribute('href')).toContain('/fr/');
      expect(canonical.getAttribute('href')).toContain('/blog');
    });
  });

  describe('with route translations', () => {
    it('translates paths using routes map', () => {
      const routes = {
        en: { '/about': '/about' },
        es: { '/about': '/sobre' },
        fr: { '/about': '/a-propos' },
      };

      const LocaleHead = createLocaleHead({ ...config, routes });
      render(<LocaleHead pathname="/about" locale="en" />);

      const esLink = document.head.querySelector(
        'link[hreflang="es"]',
      ) as HTMLLinkElement;
      expect(esLink.getAttribute('href')).toContain('/sobre');

      const frLink = document.head.querySelector(
        'link[hreflang="fr"]',
      ) as HTMLLinkElement;
      expect(frLink.getAttribute('href')).toContain('/a-propos');
    });
  });

  describe('prefix strategy', () => {
    it('uses always strategy by default', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/about" locale="en" />);

      const enLink = document.head.querySelector(
        'link[hreflang="en"]',
      ) as HTMLLinkElement;
      expect(enLink.getAttribute('href')).toContain('/en/');
    });

    it('omits prefix for default locale with as-needed strategy', () => {
      const LocaleHead = createLocaleHead({
        ...config,
        prefixStrategy: 'as-needed',
      });
      render(<LocaleHead pathname="/about" locale="en" />);

      const enLink = document.head.querySelector(
        'link[hreflang="en"]',
      ) as HTMLLinkElement;
      expect(enLink.getAttribute('href')).not.toContain('/en/');

      const esLink = document.head.querySelector(
        'link[hreflang="es"]',
      ) as HTMLLinkElement;
      expect(esLink.getAttribute('href')).toContain('/es/');
    });
  });
});

describe('factory pattern', () => {
  afterEach(() => {
    cleanup();
    document.head.querySelectorAll('link').forEach((link) => link.remove());
  });

  it('creates component with config pre-baked', () => {
    const LocaleHead = createLocaleHead({
      locales: ['en', 'de'],
      defaultLocale: 'en',
    });

    render(<LocaleHead pathname="/about" locale="en" />);
    const alternates = document.head.querySelectorAll('link[rel="alternate"]');
    expect(alternates).toHaveLength(3); // 2 locales + x-default
  });

  it('allows creating multiple configured components', () => {
    const EnglishHead = createLocaleHead({
      locales: ['en'],
      defaultLocale: 'en',
    });

    const MultilingualHead = createLocaleHead({
      locales: ['en', 'es', 'fr', 'de'],
      defaultLocale: 'en',
    });

    render(<EnglishHead pathname="/" locale="en" />);
    const count1 = document.head.querySelectorAll(
      'link[rel="alternate"]',
    ).length;

    // Clean up before next render
    cleanup();
    document.head.querySelectorAll('link').forEach((link) => link.remove());

    render(<MultilingualHead pathname="/" locale="en" />);
    const count2 = document.head.querySelectorAll(
      'link[rel="alternate"]',
    ).length;

    expect(count1).toBe(2); // 1 locale + x-default
    expect(count2).toBe(5); // 4 locales + x-default
  });
});
