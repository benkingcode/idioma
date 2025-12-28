/**
 * @vitest-environment jsdom
 */
import { render, renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HreflangLinks, useHreflangLinks } from './head.js';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  useRouterState: () => ({
    location: { pathname: '/about' },
  }),
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

describe('useHreflangLinks', () => {
  const defaultProps = {
    baseUrl: 'https://example.com',
    locales: ['en', 'es', 'fr'],
    defaultLocale: 'en',
  };

  it('generates hreflang entries for all locales', () => {
    const { result } = renderHook(() =>
      useHreflangLinks({
        ...defaultProps,
        pathname: '/about',
      }),
    );

    expect(result.current).toEqual([
      { hreflang: 'en', href: 'https://example.com/en/about' },
      { hreflang: 'es', href: 'https://example.com/es/about' },
      { hreflang: 'fr', href: 'https://example.com/fr/about' },
      { hreflang: 'x-default', href: 'https://example.com/en/about' },
    ]);
  });

  it('uses localized paths when routes provided', () => {
    const routes = {
      en: { '/about': '/about' },
      es: { '/about': '/sobre' },
      fr: { '/about': '/a-propos' },
    };

    const { result } = renderHook(() =>
      useHreflangLinks({
        ...defaultProps,
        pathname: '/about',
        routes,
      }),
    );

    expect(result.current).toEqual([
      { hreflang: 'en', href: 'https://example.com/en/about' },
      { hreflang: 'es', href: 'https://example.com/es/sobre' },
      { hreflang: 'fr', href: 'https://example.com/fr/a-propos' },
      { hreflang: 'x-default', href: 'https://example.com/en/about' },
    ]);
  });

  it('handles as-needed prefix strategy', () => {
    const { result } = renderHook(() =>
      useHreflangLinks({
        ...defaultProps,
        pathname: '/about',
        prefixStrategy: 'as-needed',
      }),
    );

    expect(result.current).toContainEqual({
      hreflang: 'en',
      href: 'https://example.com/about',
    });
    expect(result.current).toContainEqual({
      hreflang: 'es',
      href: 'https://example.com/es/about',
    });
  });
});

describe('HreflangLinks', () => {
  it('renders link elements for all locales', () => {
    render(
      <HreflangLinks
        baseUrl="https://example.com"
        locales={['en', 'es']}
        defaultLocale="en"
        pathname="/about"
      />,
    );

    // jsdom moves <link> elements to document.head
    const links = document.head.querySelectorAll('link[rel="alternate"]');
    expect(links.length).toBe(3); // en, es, x-default
    expect(links[0].getAttribute('hreflang')).toBe('en');
    expect(links[0].getAttribute('href')).toBe('https://example.com/en/about');
  });
});
