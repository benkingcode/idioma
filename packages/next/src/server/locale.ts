import { cookies } from 'next/headers';

/** Default cookie name for locale storage */
const DEFAULT_COOKIE_NAME = 'IDIOMI_LOCALE';

/**
 * Set the user's locale preference cookie.
 *
 * Use this in Server Actions when the user explicitly switches locale.
 * The middleware will read this cookie for subsequent requests.
 *
 * @example
 * ```tsx
 * 'use server';
 * import { setLocale } from '@idiomi/next/server';
 *
 * export async function switchLocale(locale: string) {
 *   await setLocale(locale);
 *   // Optionally redirect to the new locale path
 * }
 * ```
 */
export async function setLocale(
  locale: string,
  options: { cookieName?: string } = {},
): Promise<void> {
  const { cookieName = DEFAULT_COOKIE_NAME } = options;

  const cookieStore = await cookies();
  cookieStore.set(cookieName, locale, {
    path: '/',
    maxAge: 31536000, // 1 year
    sameSite: 'lax',
  });
}
