/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createLink, Link, resolveLocalizedPath } from './link.js';

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

// Mock IdiomaContext with locale 'es'
vi.mock('@idioma/react', () => ({
  IdiomaContext: React.createContext({ locale: 'es' }),
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
  it('creates Link with routes pre-configured', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
    };

    const LocalizedLink = createLink(routes);

    render(<LocalizedLink to="/about">About</LocalizedLink>);

    const link = screen.getByRole('link', { name: 'About' });
    // Context locale is 'es'
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
      <LocalizedLink to="/about" routes={propRoutes}>
        About
      </LocalizedLink>,
    );

    const link = screen.getByRole('link', { name: 'About' });
    expect(link.getAttribute('href')).toBe('/acerca');
  });

  it('allows locale prop to override context', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
      fr: { '/about': '/a-propos' },
    };

    const LocalizedLink = createLink(routes);

    render(
      <LocalizedLink to="/about" locale="fr">
        About
      </LocalizedLink>,
    );

    const link = screen.getByRole('link', { name: 'About' });
    expect(link.getAttribute('href')).toBe('/a-propos');
  });
});
