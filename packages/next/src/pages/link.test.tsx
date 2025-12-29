/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createLink, resolveLocalizedPath } from './link.js';

// Create a base Link for tests (equivalent to old default export)
const Link = createLink();

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    locale,
    children,
    ...props
  }: {
    href: string;
    locale?: string;
    children: React.ReactNode;
  }) => (
    <a href={href} data-locale={locale} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: () => ({
    locale: 'es',
    defaultLocale: 'en',
    locales: ['en', 'es', 'fr'],
  }),
}));

describe('Pages Link component', () => {
  describe('without localized paths', () => {
    it('passes href through to next/link unchanged', () => {
      render(<Link href="/about">About</Link>);

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/about');
    });

    it('passes locale prop to next/link', () => {
      render(
        <Link href="/about" locale="fr">
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('data-locale')).toBe('fr');
    });
  });

  describe('with localized paths', () => {
    const routes = {
      en: { '/about': '/about', '/blog': '/blog' },
      es: { '/about': '/sobre', '/blog': '/articulos' },
      fr: { '/about': '/a-propos', '/blog': '/articles' },
    };

    it('transforms path using routes map for current locale', () => {
      render(
        <Link href="/about" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      // Current locale is 'es' from mock
      expect(link.getAttribute('href')).toBe('/sobre');
    });

    it('transforms path for explicit locale override', () => {
      render(
        <Link href="/about" locale="fr" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/a-propos');
    });

    it('falls back to original path when no translation', () => {
      render(
        <Link href="/contact" routes={routes}>
          Contact
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'Contact' });
      expect(link.getAttribute('href')).toBe('/contact');
    });
  });

  describe('prop forwarding', () => {
    it('passes className and other props to next/link', () => {
      render(
        <Link href="/about" className="nav-link" data-testid="about-link">
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.className).toContain('nav-link');
      expect(link.getAttribute('data-testid')).toBe('about-link');
    });
  });
});

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

describe('createLink factory', () => {
  const routes = {
    en: { '/about': '/about' },
    es: { '/about': '/sobre' },
    fr: { '/about': '/a-propos' },
  };

  it('creates Link with routes pre-configured', () => {
    const LocalizedLink = createLink(routes);

    render(<LocalizedLink href="/about">About</LocalizedLink>);

    const link = screen.getByRole('link', { name: 'About' });
    // Router locale is 'es' from mock
    expect(link.getAttribute('href')).toBe('/sobre');
  });

  it('allows prop routes to override factory routes', () => {
    const factoryRoutes = {
      es: { '/about': '/sobre' },
    };

    const propRoutes = {
      es: { '/about': '/acerca' },
    };

    const LocalizedLink = createLink(factoryRoutes);

    render(
      <LocalizedLink href="/about" routes={propRoutes}>
        About
      </LocalizedLink>,
    );

    const link = screen.getByRole('link', { name: 'About' });
    expect(link.getAttribute('href')).toBe('/acerca');
  });

  it('allows locale prop to override router locale', () => {
    const LocalizedLink = createLink(routes);

    render(
      <LocalizedLink href="/about" locale="fr">
        About
      </LocalizedLink>,
    );

    const link = screen.getByRole('link', { name: 'About' });
    expect(link.getAttribute('href')).toBe('/a-propos');
  });
});
