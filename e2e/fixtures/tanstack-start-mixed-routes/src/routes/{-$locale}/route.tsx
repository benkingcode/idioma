import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { LocaleHead, useLocale } from '../../idiomi';
import type { Locale } from '../../idiomi';
import {
  getCanonicalPath,
  getLocalizedPath,
} from '../../idiomi/.generated/routes';

export const Route = createFileRoute('/{-$locale}')({
  component: LocaleLayout,
});

/** Set locale cookie with 1 year expiry */
function setLocaleCookie(locale: string) {
  document.cookie = `IDIOMI_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}

function LocaleLayout() {
  // IdiomiProvider is now at __root.tsx - locale comes from context
  return (
    <>
      <LocaleHead />
      <Navigation />
      <main data-testid="main-content">
        <Outlet />
      </main>
    </>
  );
}

function Navigation() {
  const locale = useLocale();
  const location = useLocation();
  const [isHydrated, setIsHydrated] = useState(false);

  // Mark as hydrated when React is ready
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Calculate locale switch URLs using router location
  const currentPath = location.pathname;
  const pathWithoutLocale = currentPath.replace(/^\/(en|es)/, '') || '/';
  const searchParams = location.searchStr || '';
  const hash = location.hash || '';

  const canonicalPath = getCanonicalPath(pathWithoutLocale, locale);

  const getLocaleUrl = (newLocale: Locale) => {
    const localizedPath = getLocalizedPath(canonicalPath, newLocale);
    const newPath =
      newLocale === 'en' ? localizedPath : `/${newLocale}${localizedPath}`;
    return `${newPath}${searchParams}${hash}`;
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
      <Link to="/{-$locale}" params={{ locale }} data-testid="nav-home">
        Home
      </Link>
      <Link to="/{-$locale}/about" params={{ locale }} data-testid="nav-about">
        About
      </Link>
      <Link to="/dashboard" data-testid="nav-dashboard">
        Dashboard
      </Link>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
        <a
          href={getLocaleUrl('en')}
          data-testid="locale-en"
          onClick={(e) => handleLocaleClick(e, 'en')}
          style={{
            fontWeight: locale === 'en' ? 'bold' : 'normal',
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
            fontWeight: locale === 'es' ? 'bold' : 'normal',
            cursor: 'pointer',
          }}
        >
          Espanol
        </a>
      </div>
    </nav>
  );
}
