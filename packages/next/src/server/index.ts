/**
 * Server-side utilities for Next.js App Router.
 *
 * @example
 * ```tsx
 * // Server Action to switch locale
 * 'use server';
 * import { setLocale } from '@idiomi/next/server';
 *
 * export async function switchLocale(locale: string) {
 *   await setLocale(locale);
 * }
 * ```
 */

export { setLocale } from './locale.js';
