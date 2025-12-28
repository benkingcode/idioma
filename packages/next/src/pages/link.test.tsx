/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Link } from './link.js';

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
