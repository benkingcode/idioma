/**
 * Shared configuration types for TanStack locale handling.
 *
 * Both SPA (client.ts) and SSR (server.ts) APIs extend these base types
 * to ensure consistent configuration across platforms.
 */

/**
 * Base locale configuration shared by all factory functions.
 *
 * This interface captures the minimal required configuration for any
 * locale-aware factory in the TanStack integration.
 */
export interface BaseLocaleConfig<L extends string = string> {
  /** All supported locales (e.g., ['en', 'es', 'fr']) */
  readonly locales: readonly L[];
  /** Fallback locale when detection fails or no preference is set */
  readonly defaultLocale: L;
}

/**
 * URL prefix strategy for locale routing.
 *
 * - `'always'`: Always show locale prefix (e.g., /en/about, /es/about)
 * - `'as-needed'`: Only show prefix for non-default locales (e.g., /about, /es/about)
 * - `'never'`: Never show prefix in URLs (locale detected from cookie/header only)
 */
export type PrefixStrategy = 'always' | 'as-needed' | 'never';
