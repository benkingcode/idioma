'use client';

import { getLocaleHead, IdiomaContext, type RoutesMap } from '@idioma/react';
import { usePathname } from 'next/navigation';
import React, { useContext } from 'react';

export interface LocaleHeadProps {
  /** Current pathname. Optional in client components (uses usePathname). */
  pathname?: string;
  /** Current locale. Optional in client components (uses IdiomaContext). */
  locale?: string;
}

export interface LocaleHeadConfig {
  /** Base URL for absolute URLs (e.g., 'https://example.com'). Empty string for relative URLs. */
  metadataBase?: string;
  /** All supported locales */
  locales: string[];
  /** Default locale */
  defaultLocale: string;
  /** Route translations map (from compiled routes) */
  routes?: RoutesMap;
  /** Prefix strategy: 'always' or 'as-needed' */
  prefixStrategy?: 'always' | 'as-needed';
}

/**
 * Creates a LocaleHead component with configuration pre-baked.
 *
 * Use this factory in your idioma/index.ts to create a configured LocaleHead.
 *
 * @example
 * ```tsx
 * // idioma/index.ts
 * import { createLocaleHead } from '@idioma/next';
 * import { routes } from './.generated/routes';
 *
 * export const LocaleHead = createLocaleHead({
 *   metadataBase: 'https://example.com',
 *   locales: ['en', 'es', 'fr'],
 *   defaultLocale: 'en',
 *   routes,
 * });
 *
 * // Client component - zero props needed!
 * 'use client';
 * import { LocaleHead } from '@/idioma';
 *
 * function MyComponent() {
 *   return <LocaleHead />;
 * }
 *
 * // Server component - both props required
 * import { LocaleHead } from '@/idioma';
 *
 * export default function Layout({ params }) {
 *   return (
 *     <html>
 *       <head>
 *         <LocaleHead pathname="/about" locale={params.lang} />
 *       </head>
 *     </html>
 *   );
 * }
 * ```
 */
export function createLocaleHead(config: LocaleHeadConfig) {
  const {
    metadataBase = '',
    locales,
    defaultLocale,
    routes,
    prefixStrategy = 'always',
  } = config;

  return function LocaleHead(props: LocaleHeadProps): React.ReactElement {
    // Try props first, fall back to hooks
    const routerPathname = usePathname();
    const context = useContext(IdiomaContext);

    const pathname = props.pathname ?? routerPathname;
    const locale = props.locale ?? context?.locale;

    if (!pathname || !locale) {
      throw new Error(
        '[idioma] LocaleHead requires pathname and locale. Either:\n' +
          '1. Use in a Client Component with IdiomaProvider (auto from context/router)\n' +
          '2. Pass both props: <LocaleHead pathname="/about" locale={params.lang} />',
      );
    }

    const { links, canonical } = getLocaleHead({
      pathname,
      locale,
      metadataBase,
      locales,
      defaultLocale,
      routes,
      prefixStrategy,
    });

    return (
      <>
        <link rel="canonical" href={canonical} />
        {links.map(({ hreflang, href }) => (
          <link
            key={hreflang}
            rel="alternate"
            hrefLang={hreflang}
            href={href}
          />
        ))}
      </>
    );
  };
}
