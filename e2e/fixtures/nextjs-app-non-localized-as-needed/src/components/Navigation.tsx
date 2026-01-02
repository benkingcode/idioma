'use client';

import { useLocale } from '@/idiomi';
import type { Locale } from '@/idiomi';
import { Link } from '@/idiomi/client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/** Set locale cookie with 1 year expiry */
function setLocaleCookie(locale: string) {
  document.cookie = `IDIOMI_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

export function Navigation() {
  const locale = useLocale();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated when React is ready
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Strip locale prefix from current path (non-localized paths don't translate routes)
  const pathWithoutLocale = pathname.replace(/^\/(en|es)/, '') || '/';

  // Calculate locale switch URLs - routes stay the same, only prefix changes
  const getLocaleUrl = (newLocale: Locale) => {
    // For 'as-needed' strategy: default locale has no prefix, others have prefix
    return newLocale === 'en'
      ? pathWithoutLocale
      : `/${newLocale}${pathWithoutLocale}`;
  };

  const handleLocaleClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    newLocale: Locale,
  ) => {
    // Prevent default to avoid race condition where HTTP request
    // might be sent before the cookie is updated in the browser
    e.preventDefault();
    setLocaleCookie(newLocale);
    // Navigate programmatically after cookie is guaranteed to be set
    window.location.href = getLocaleUrl(newLocale);
  };

  return (
    <nav
      data-testid="navigation"
      data-hydrated={isHydrated ? 'true' : undefined}
      style={{
        marginBottom: '20px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
      }}
    >
      <Link href="/" data-testid="nav-home">
        Home
      </Link>
      <Link href="/about" data-testid="nav-about">
        About
      </Link>
      <Link href="/blog" data-testid="nav-blog">
        Blog
      </Link>
      <Link href="/contact" data-testid="nav-contact">
        Contact
      </Link>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <a
          href={getLocaleUrl('en')}
          data-testid="locale-en"
          onClick={(e) => handleLocaleClick(e, 'en')}
          style={{
            fontWeight: locale === 'en' ? 700 : 400,
            cursor: 'pointer',
          }}
        >
          English
        </a>
        <a
          href={getLocaleUrl('es')}
          data-testid="locale-es"
          onClick={(e) => handleLocaleClick(e, 'es')}
          style={{
            fontWeight: locale === 'es' ? 700 : 400,
            cursor: 'pointer',
          }}
        >
          Español
        </a>
      </div>
    </nav>
  );
}
