import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Link } from './link.js';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock the IdiomaContext
vi.mock('@idioma/react', () => ({
  IdiomaContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
  },
}));

// Mock React's useContext to return our locale
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: () => ({ locale: 'en' }),
  };
});

describe('Link component', () => {
  describe('without localized paths', () => {
    it('adds locale prefix from context', () => {
      // Mock context has locale 'en'
      render(<Link href="/about">About</Link>);

      const link = screen.getByRole('link', {
        name: 'About',
      }) as HTMLAnchorElement;
      // Link adds locale prefix from context
      expect(link.getAttribute('href')).toBe('/en/about');
    });

    it('adds locale prefix when locale prop provided', () => {
      render(
        <Link href="/about" locale="es">
          About
        </Link>,
      );

      const link = screen.getByRole('link', {
        name: 'About',
      }) as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/es/about');
    });
  });

  describe('with localized paths', () => {
    it('transforms path using routes map', () => {
      const routes = {
        en: { '/about': '/about' },
        es: { '/about': '/sobre' },
      };

      render(
        <Link href="/about" locale="es" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', {
        name: 'About',
      }) as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/es/sobre');
    });

    it('falls back to original path when no translation', () => {
      const routes = {
        en: { '/about': '/about' },
        es: {},
      };

      render(
        <Link href="/contact" locale="es" routes={routes}>
          Contact
        </Link>,
      );

      const link = screen.getByRole('link', {
        name: 'Contact',
      }) as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('/es/contact');
    });
  });

  describe('prop forwarding', () => {
    it('passes className and other props to next/link', () => {
      render(
        <Link href="/about" className="nav-link" data-testid="about-link">
          About
        </Link>,
      );

      const link = screen.getByRole('link', {
        name: 'About',
      }) as HTMLAnchorElement;
      expect(link.className).toContain('nav-link');
      expect(link.getAttribute('data-testid')).toBe('about-link');
    });
  });
});
