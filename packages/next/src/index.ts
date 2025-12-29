/**
 * @idioma/next - Next.js integration for Idioma i18n
 *
 * Supports both App Router and Pages Router with:
 * - Locale detection (cookie, Accept-Language header)
 * - Prefix strategies (always vs as-needed)
 * - Localized paths (optional, when routing.localizedPaths: true)
 * - SEO metadata generation (hreflang tags)
 *
 * @example App Router setup
 * ```tsx
 * // middleware.ts
 * import { createIdiomaMiddleware } from '@idioma/next/middleware';
 *
 * export default createIdiomaMiddleware({
 *   defaultLocale: 'en',
 *   locales: ['en', 'es', 'fr'],
 * });
 *
 * // app/[lang]/layout.tsx
 * export default function Layout({
 *   children,
 *   params,
 * }: {
 *   children: React.ReactNode;
 *   params: { lang: string };
 * }) {
 *   return (
 *     <IdiomaProvider locale={params.lang}>
 *       {children}
 *     </IdiomaProvider>
 *   );
 * }
 * ```
 *
 * @example Pages Router setup
 * ```tsx
 * // next.config.js - use built-in i18n
 * module.exports = {
 *   i18n: {
 *     locales: ['en', 'es', 'fr'],
 *     defaultLocale: 'en',
 *   },
 * };
 *
 * // _app.tsx
 * import { useRouter } from 'next/router';
 * import { IdiomaProvider } from '@idioma/react';
 *
 * export default function App({ Component, pageProps }) {
 *   const { locale } = useRouter();
 *   return (
 *     <IdiomaProvider locale={locale}>
 *       <Component {...pageProps} />
 *     </IdiomaProvider>
 *   );
 * }
 * ```
 */

export {
  createIdiomaMiddleware,
  type IdiomaMiddlewareConfig,
} from './middleware.js';

export {
  createLink,
  resolveLocalizedHref,
  resolveLocalizedPath,
  type LinkProps,
  type RoutesMap,
} from './link.js';

export {
  createLocaleHead,
  type LocaleHeadProps,
  type LocaleHeadConfig,
} from './LocaleHead.js';
