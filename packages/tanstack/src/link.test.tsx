/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Link } from './link.js';

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

// Mock IdiomaContext
vi.mock('@idioma/react', () => ({
  IdiomaContext: {},
}));

// Mock React's useContext
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useContext: () => ({ locale: 'es' }),
  };
});

describe('TanStack Link component', () => {
  describe('without localized paths', () => {
    it('passes href through unchanged', () => {
      render(<Link to="/about">About</Link>);

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/about');
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
        <Link to="/about" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      // Current locale is 'es' from mock
      expect(link.getAttribute('href')).toBe('/sobre');
    });

    it('transforms path for explicit locale override', () => {
      render(
        <Link to="/about" locale="fr" routes={routes}>
          About
        </Link>,
      );

      const link = screen.getByRole('link', { name: 'About' });
      expect(link.getAttribute('href')).toBe('/a-propos');
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
