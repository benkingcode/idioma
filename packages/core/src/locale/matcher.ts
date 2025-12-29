/**
 * Locale matching utilities using @formatjs/intl-localematcher.
 *
 * Provides BCP 47-compliant locale negotiation with language distance
 * algorithms for matching user preferences to available locales.
 */

import { match as formatjsMatch } from '@formatjs/intl-localematcher';

/**
 * Options for locale matching.
 */
export interface MatchLocaleOptions {
  /** Available locales to match against */
  locales: string[];
  /** Default locale to use when no match is found */
  defaultLocale: string;
  /**
   * Matching algorithm:
   * - 'best fit': Uses language distance (e.g., en-GB matches en-US)
   * - 'lookup': Strict RFC 4647 matching (e.g., en-GB only matches en)
   * @default 'best fit'
   */
  algorithm?: 'lookup' | 'best fit';
}

/**
 * Parse an Accept-Language header into an array of locale strings,
 * sorted by quality factor (descending).
 *
 * Preserves full locale codes (e.g., 'en-US') rather than stripping
 * to base language codes.
 *
 * @param header - The Accept-Language header value (e.g., 'en-US,en;q=0.9,es;q=0.8')
 * @returns Array of locale codes sorted by preference
 *
 * @example
 * parseAcceptLanguageHeader('en-US,en;q=0.9,es;q=0.8')
 * // => ['en-US', 'en', 'es']
 */
export function parseAcceptLanguageHeader(header: string | null): string[] {
  if (!header) return [];

  return header
    .split(',')
    .map((lang) => {
      const trimmed = lang.trim();
      const [code, qualityStr] = trimmed.split(';q=');
      return {
        code: code?.trim() ?? '',
        quality: qualityStr ? parseFloat(qualityStr) : 1,
      };
    })
    .filter(({ code, quality }) => code.length > 0 && !Number.isNaN(quality))
    .sort((a, b) => b.quality - a.quality)
    .map(({ code }) => code);
}

/**
 * Match a locale preference against available locales using BCP 47 algorithms.
 *
 * Supports both "best fit" (language distance) and "lookup" (strict) matching.
 * The "best fit" algorithm uses CLDR language distance data to find the closest
 * match even when there's no exact match (e.g., en-GB matches en-US).
 *
 * @param requested - Accept-Language header string, array of locale codes, or single locale
 * @param options - Matching options including available locales and algorithm
 * @returns The matched locale, or defaultLocale if no match found
 *
 * @example
 * // With Accept-Language header
 * matchLocale('en-GB,en;q=0.9', {
 *   locales: ['en-US', 'es', 'de'],
 *   defaultLocale: 'de',
 * })
 * // => 'en-US' (en-GB matches en-US via language distance)
 *
 * @example
 * // With strict lookup algorithm
 * matchLocale('en-GB', {
 *   locales: ['en-US', 'de'],
 *   defaultLocale: 'de',
 *   algorithm: 'lookup',
 * })
 * // => 'de' (en-GB doesn't match en-US with strict matching)
 *
 * @example
 * // For TanStack Start server loaders
 * export async function serverLoader({ request }) {
 *   const acceptLanguage = request.headers.get('accept-language');
 *   const locale = matchLocale(acceptLanguage, {
 *     locales: ['en', 'es', 'fr'],
 *     defaultLocale: 'en',
 *   });
 *   return { locale };
 * }
 */
export function matchLocale(
  requested: string | string[] | null | undefined,
  options: MatchLocaleOptions,
): string {
  const { locales, defaultLocale, algorithm = 'best fit' } = options;

  // Normalize input to array of locale codes
  let requestedLocales: string[];

  if (requested === null || requested === undefined) {
    requestedLocales = [];
  } else if (typeof requested === 'string') {
    // Check if it looks like an Accept-Language header (contains comma or semicolon)
    if (requested.includes(',') || requested.includes(';')) {
      requestedLocales = parseAcceptLanguageHeader(requested);
    } else {
      // Single locale code
      requestedLocales = [requested];
    }
  } else {
    requestedLocales = requested;
  }

  if (requestedLocales.length === 0) {
    return defaultLocale;
  }

  try {
    return formatjsMatch(requestedLocales, locales, defaultLocale, {
      algorithm,
    });
  } catch {
    // If matching fails (e.g., invalid locale format), return default
    return defaultLocale;
  }
}
