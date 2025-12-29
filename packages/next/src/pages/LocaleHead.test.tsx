/**
 * @vitest-environment jsdom
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import after mock setup
import { createLocaleHead } from './LocaleHead.js';

// vi.hoisted runs before vi.mock hoisting - this is the key!
const mockRouterState = vi.hoisted(() => ({
  asPath: '/about?query=test',
  locale: 'en',
  defaultLocale: 'en',
}));

// Mock next/router - factory can access hoisted mockRouterState
vi.mock('next/router', () => ({
  useRouter: () => mockRouterState,
}));

describe('createLocaleHead (Pages Router)', () => {
  const config = {
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
    metadataBase: 'https://example.com',
  };

  beforeEach(() => {
    mockRouterState.asPath = '/about?query=test';
    mockRouterState.locale = 'en';
  });

  // Clean up properly: first unmount React, then clean up stray links
  afterEach(() => {
    cleanup(); // RTL cleanup unmounts components properly
    document.head.querySelectorAll('link').forEach((link) => link.remove());
  });

  describe('basic rendering', () => {
    it('renders canonical link', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead />);

      // <link> elements render to document.head, not the container
      const canonical = document.head.querySelector('link[rel="canonical"]');
      expect(canonical).toBeTruthy();
      expect(canonical?.getAttribute('href')).toContain('example.com');
    });

    it('renders hreflang links for all locales', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead />);

      const alternates = document.head.querySelectorAll(
        'link[rel="alternate"]',
      );
      expect(alternates).toHaveLength(4); // 3 locales + x-default
    });

    it('strips query string from router.asPath', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead />);

      const canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      // Should not contain query string
      expect(canonical.getAttribute('href')).not.toContain('?');
      expect(canonical.getAttribute('href')).toContain('/about');
    });
  });

  describe('with explicit props', () => {
    it('uses pathname prop over router.asPath', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead pathname="/contact" />);

      const canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      expect(canonical.getAttribute('href')).toContain('/contact');
    });

    it('uses locale prop over router.locale', () => {
      const LocaleHead = createLocaleHead(config);
      render(<LocaleHead locale="es" />);

      const canonical = document.head.querySelector(
        'link[rel="canonical"]',
      ) as HTMLLinkElement;
      expect(canonical.getAttribute('href')).toContain('/es/');
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
      render(<LocaleHead />);

      const esLink = document.head.querySelector(
        'link[hreflang="es"]',
      ) as HTMLLinkElement;
      expect(esLink.getAttribute('href')).toContain('/sobre');
    });
  });

  describe('prefix strategy', () => {
    it('omits prefix for default locale with as-needed strategy', () => {
      const LocaleHead = createLocaleHead({
        ...config,
        prefixStrategy: 'as-needed',
      });
      render(<LocaleHead />);

      const enLink = document.head.querySelector(
        'link[hreflang="en"]',
      ) as HTMLLinkElement;
      expect(enLink.getAttribute('href')).not.toContain('/en/');
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

    render(<LocaleHead />);
    const alternates = document.head.querySelectorAll('link[rel="alternate"]');
    expect(alternates).toHaveLength(3); // 2 locales + x-default
  });
});
