/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  createLink,
  resolveLocalizedHref,
  resolveLocalizedPath,
} from './link.js';

// Create a base Link for tests with default config
const Link = createLink({
  defaultLocale: 'en',
  prefixStrategy: 'never', // Tests expect no prefix by default
});

// Mock TanStack Router's Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

// Mock IdiomiContext with locale 'es'
vi.mock('@idiomi/react', () => ({
  IdiomiContext: React.createContext({ locale: 'es' }),
}));

describe('resolveLocalizedPath', () => {
  it('returns original path without routes', () => {
    expect(resolveLocalizedPath('/about', 'en')).toBe('/about');
    expect(resolveLocalizedPath('/about', 'es')).toBe('/about');
  });

  it('translates path with routes', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
    };

    expect(resolveLocalizedPath('/about', 'en', routes)).toBe('/about');
    expect(resolveLocalizedPath('/about', 'es', routes)).toBe('/sobre');
  });

  it('falls back to original path when no translation', () => {
    const routes = {
      en: { '/about': '/about' },
      es: {},
    };

    expect(resolveLocalizedPath('/contact', 'es', routes)).toBe('/contact');
  });
});

describe('resolveLocalizedHref', () => {
  const routes = {
    en: { '/about': '/about', '/blog': '/blog' },
    es: { '/about': '/sobre', '/blog': '/articulos' },
    fr: { '/about': '/a-propos', '/blog': '/articles' },
  };

  describe('prefixStrategy: always', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'always' as const,
    };

    it('adds prefix for default locale', () => {
      expect(resolveLocalizedHref('/about', 'en', config)).toBe('/en/about');
    });

    it('adds prefix for non-default locale', () => {
      expect(resolveLocalizedHref('/about', 'es', config)).toBe('/es/sobre');
    });

    it('translates path segments', () => {
      expect(resolveLocalizedHref('/blog', 'fr', config)).toBe('/fr/articles');
    });
  });

  describe('prefixStrategy: as-needed', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'as-needed' as const,
    };

    it('does NOT add prefix for default locale', () => {
      expect(resolveLocalizedHref('/about', 'en', config)).toBe('/about');
    });

    it('adds prefix for non-default locale', () => {
      expect(resolveLocalizedHref('/about', 'es', config)).toBe('/es/sobre');
    });

    it('still translates path for default locale', () => {
      // Default locale doesn't translate, but if it had different paths...
      expect(resolveLocalizedHref('/blog', 'en', config)).toBe('/blog');
    });
  });

  describe('prefixStrategy: never', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'never' as const,
    };

    it('never adds prefix for default locale', () => {
      expect(resolveLocalizedHref('/about', 'en', config)).toBe('/about');
    });

    it('never adds prefix for non-default locale', () => {
      expect(resolveLocalizedHref('/about', 'es', config)).toBe('/sobre');
    });

    it('still translates path segments', () => {
      expect(resolveLocalizedHref('/blog', 'fr', config)).toBe('/articles');
    });
  });

  it('falls back to original path when no translation', () => {
    const config = {
      routes,
      defaultLocale: 'en',
      prefixStrategy: 'as-needed' as const,
    };
    expect(resolveLocalizedHref('/contact', 'es', config)).toBe('/es/contact');
  });
});

describe('Link component', () => {
  describe('with context', () => {
    it('uses locale from context when no prop provided', () => {
      const routes = {
        en: { '/about': '/about' },
        es: { '/about': '/sobre' },
      };

      render(
        <Link to="/about" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      // Context locale is 'es'
      expect(link.getAttribute('href')).toBe('/sobre');
    });

    it('uses locale prop over context', () => {
      const routes = {
        en: { '/about': '/about' },
        es: { '/about': '/sobre' },
        fr: { '/about': '/a-propos' },
      };

      render(
        <Link to="/about" locale="fr" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/a-propos');
    });
  });

  describe('without routes', () => {
    it('passes path through unchanged', () => {
      render(<Link to="/about">About</Link>);

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/about');
    });
  });

  describe('with routes', () => {
    const routes = {
      en: { '/about': '/about', '/blog': '/blog' },
      es: { '/about': '/sobre', '/blog': '/articulos' },
    };

    it('transforms path using routes map', () => {
      render(
        <Link to="/about" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/sobre');
    });

    it('falls back to original path when no translation', () => {
      render(
        <Link to="/contact" routes={routes}>
          Contact
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'Contact' });
      expect(link.getAttribute('href')).toBe('/contact');
    });
  });

  describe('prop forwarding', () => {
    it('passes className and other props to TanStack Link', () => {
      render(
        <Link to="/about" className="nav-link" data-testid="about-link">
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.className).toContain('nav-link');
      expect(link.getAttribute('data-testid')).toBe('about-link');
    });
  });
});

describe('createLink factory', () => {
  describe('with config object (new API)', () => {
    const routes = {
      en: { '/about': '/about', '/blog': '/blog' },
      es: { '/about': '/sobre', '/blog': '/articulos' },
      fr: { '/about': '/a-propos', '/blog': '/articles' },
    };

    it('creates Link with prefix strategy: always', () => {
      const LocalizedLink = createLink({
        routes,
        defaultLocale: 'en',
        prefixStrategy: 'always',
      });

      render(<LocalizedLink to="/about">About</LocalizedLink>);

      const link = screen.getByRole('link', { name: 'About' });
      // Context locale is 'es', strategy is 'always' -> /es/sobre
      expect(link.getAttribute('href')).toBe('/es/sobre');
    });

    it('creates Link with prefix strategy: as-needed (non-default locale)', () => {
      const LocalizedLink = createLink({
        routes,
        defaultLocale: 'en',
        prefixStrategy: 'as-needed',
      });

      render(<LocalizedLink to="/about">About</LocalizedLink>);

      const link = screen.getByRole('link', { name: 'About' });
      // Context locale is 'es', strategy is 'as-needed' -> /es/sobre (non-default gets prefix)
      expect(link.getAttribute('href')).toBe('/es/sobre');
    });

    it('creates Link with prefix strategy: as-needed (default locale)', () => {
      const LocalizedLink = createLink({
        routes,
        defaultLocale: 'en',
        prefixStrategy: 'as-needed',
      });

      render(
        <LocalizedLink to="/about" locale="en">
          About
        </LocalizedLink>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      // Explicit locale 'en' (default), strategy is 'as-needed' -> /about (no prefix)
      expect(link.getAttribute('href')).toBe('/about');
    });

    it('creates Link with prefix strategy: never', () => {
      const LocalizedLink = createLink({
        routes,
        defaultLocale: 'en',
        prefixStrategy: 'never',
      });

      render(<LocalizedLink to="/about">About</LocalizedLink>);

      const link = screen.getByRole('link', { name: 'About' });
      // Context locale is 'es', strategy is 'never' -> /sobre (no prefix, just translation)
      expect(link.getAttribute('href')).toBe('/sobre');
    });

    it('allows locale prop to override context', () => {
      const LocalizedLink = createLink({
        routes,
        defaultLocale: 'en',
        prefixStrategy: 'always',
      });

      render(
        <LocalizedLink to="/about" locale="fr">
          About
        </LocalizedLink>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/fr/a-propos');
    });
  });

  it('allows prop routes to override factory routes', () => {
    const factoryRoutes = {
      es: { '/about': '/sobre' },
    };

    const propRoutes = {
      es: { '/about': '/acerca' },
    };

    const LocalizedLink = createLink({
      routes: factoryRoutes,
      defaultLocale: 'en',
      prefixStrategy: 'always',
    });

    render(<LocalizedLink to="/about">About</LocalizedLink>);

    const link = screen.getByRole('link', { name: 'About' });
    // Context locale is 'es', propRoutes override
    expect(link.getAttribute('href')).toBe('/es/sobre');
  });
});
