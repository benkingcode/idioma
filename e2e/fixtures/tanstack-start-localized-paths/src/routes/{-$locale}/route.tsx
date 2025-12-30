import {
  createFileRoute,
  Link,
  Outlet,
  useLocation,
} from '@tanstack/react-router';
import {
  defaultLocale,
  IdiomiProvider,
  LocaleHead,
  useLocale,
} from '../../idiomi';
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
  const { locale: urlLocale } = Route.useParams();

  // Server handles detection; unprefixed URLs are always default locale
  const locale = (urlLocale ?? defaultLocale) as Locale;

  return (
    <IdiomiProvider locale={locale}>
      <LocaleHead />
      <Navigation />
      <main data-testid="main-content">
        <Outlet />
      </main>
    </IdiomiProvider>
  );
}

function Navigation() {
  const locale = useLocale();
  const location = useLocation();

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
    _e: React.MouseEvent<HTMLAnchorElement>,
    newLocale: Locale,
  ) => {
    // Set cookie before the natural anchor navigation
    setLocaleCookie(newLocale);
  };

  return (
    <nav
      data-testid="navigation"
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
      <Link to="/{-$locale}/blog" params={{ locale }} data-testid="nav-blog">
        Blog
      </Link>
      <Link
        to="/{-$locale}/contact"
        params={{ locale }}
        data-testid="nav-contact"
      >
        Contact
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
