/**
 * Internal detection helpers for server/client locale detection.
 *
 * These functions are environment-specific and should only be called
 * in the appropriate context (server or client).
 */

import { isLocaleCompatible, matchLocale } from '@idiomi/core/locale';
import { parseCookie } from './helpers.js';

// ============================================================
// Types
// ============================================================

/**
 * Detection source configuration.
 * Shared type for both client and server locale detection.
 */
export interface DetectionOptions {
  readonly order?: readonly ('cookie' | 'header')[];
  readonly cookieName?: string;
  /**
   * Matching algorithm for language detection:
   * - 'best fit': Uses language distance (e.g., en-GB matches en-US)
   * - 'lookup': Strict RFC 4647 matching (e.g., en-GB only matches en)
   * @default 'best fit'
   */
  readonly algorithm?: 'lookup' | 'best fit';
}

export interface DetectionContext<L extends string = string> {
  readonly locales: readonly L[];
  readonly defaultLocale: L;
  readonly order: readonly ('cookie' | 'header')[];
  readonly cookieName: string;
  readonly algorithm: 'lookup' | 'best fit';
}

// ============================================================
// Server-Side Detection
// ============================================================

/**
 * Server-side locale detection using request headers.
 *
 * Uses BCP 47-compliant matching via @idiomi/core/locale for Accept-Language.
 * Only call this on the server.
 *
 * @param cookieHeader - The Cookie header value from the request
 * @param acceptLanguage - The Accept-Language header value from the request
 * @param ctx - Detection context with locales, order, etc.
 * @returns The detected locale
 */
export function detectLocaleFromHeaders<L extends string>(
  cookieHeader: string | null,
  acceptLanguage: string | null,
  ctx: DetectionContext<L>,
): L {
  for (const source of ctx.order) {
    if (source === 'cookie') {
      const cookie = parseCookie(cookieHeader, ctx.cookieName);
      if (cookie && (ctx.locales as readonly string[]).includes(cookie)) {
        return cookie as L;
      }
    }
    if (source === 'header' && acceptLanguage) {
      const matched = matchLocale(acceptLanguage, {
        locales: ctx.locales as unknown as string[],
        defaultLocale: ctx.defaultLocale,
        algorithm: ctx.algorithm,
      });
      if (matched && (ctx.locales as readonly string[]).includes(matched)) {
        return matched as L;
      }
    }
  }
  return ctx.defaultLocale;
}

// ============================================================
// Client-Side Detection
// ============================================================

/**
 * Client-side locale detection using browser APIs.
 *
 * Uses BCP 47-compliant matching via @idiomi/core/locale for navigator.languages.
 * Only call this on the client.
 *
 * @param ctx - Detection context with locales, order, etc.
 * @returns The detected locale
 */
export function detectLocaleFromBrowser<L extends string>(
  ctx: DetectionContext<L>,
): L {
  for (const source of ctx.order) {
    if (source === 'cookie') {
      const cookie = parseCookie(
        typeof document !== 'undefined' ? document.cookie : null,
        ctx.cookieName,
      );
      if (cookie && (ctx.locales as readonly string[]).includes(cookie)) {
        return cookie as L;
      }
    }
    if (source === 'header') {
      if (typeof navigator !== 'undefined' && navigator.languages?.length) {
        // Use BCP 47 matching with algorithm support (same as server)
        const matched = matchLocale(navigator.languages, {
          locales: ctx.locales,
          defaultLocale: ctx.defaultLocale,
          algorithm: ctx.algorithm,
        });
        // Only return if browser languages actually matched (not just fallback to default)
        if (isLocaleCompatible(navigator.languages, matched, ctx.algorithm)) {
          return matched as L;
        }
      }
    }
  }
  return ctx.defaultLocale;
}
