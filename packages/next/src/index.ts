/**
 * @idiomi/next - Next.js integration for Idiomi i18n
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
 * import { createIdiomiMiddleware } from '@idiomi/next/middleware';
 *
 * export default createIdiomiMiddleware({
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
 *     <IdiomiProvider locale={params.lang}>
 *       {children}
 *     </IdiomiProvider>
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
 * import { IdiomiProvider } from '@idiomi/react';
 *
 * export default function App({ Component, pageProps }) {
 *   const { locale } = useRouter();
 *   return (
 *     <IdiomiProvider locale={locale}>
 *       <Component {...pageProps} />
 *     </IdiomiProvider>
 *   );
 * }
 * ```
 */

export {
  createIdiomiMiddleware,
  type IdiomiMiddlewareConfig,
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
