import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
} from '@tanstack/react-router';
import {
  detectClientLocale,
  IdiomiProvider,
  LocaleHead,
  localeLoader,
  useLocale,
} from '../../idiomi';
import type { Locale } from '../../idiomi';
import {
  getCanonicalPath,
  getLocalizedPath,
} from '../../idiomi/.generated/routes';

export const Route = createFileRoute('/{-$locale}')({
  beforeLoad: localeLoader,
  component: LocaleLayout,
});

/** Set locale cookie with 1 year expiry */
function setLocaleCookie(locale: string) {
  document.cookie = `IDIOMA_LOCALE=${locale};path=/;max-age=${60 * 60 * 24 * 365}`;
}

function LocaleLayout() {
  const { locale: urlLocale } = Route.useParams();

  // Use URL locale if valid, otherwise detect from cookie/browser
  const locale = (urlLocale as Locale) ?? detectClientLocale();

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
  const navigate = useNavigate();

  const handleLocaleChange = (newLocale: Locale) => {
    setLocaleCookie(newLocale);

    // Get current path without locale prefix
    const currentPath = window.location.pathname;
    const pathWithoutLocale = currentPath.replace(/^\/(en|es)/, '') || '/';

    // Preserve query params and hash
    const searchParams = window.location.search;
    const hash = window.location.hash;

    // Translate back to canonical path, then to new locale's path
    const canonicalPath = getCanonicalPath(pathWithoutLocale, locale);
    const localizedPath = getLocalizedPath(canonicalPath, newLocale);

    // Build new URL with locale prefix (if needed)
    const newPath =
      newLocale === 'en' ? localizedPath : `/${newLocale}${localizedPath}`;

    navigate({ to: `${newPath}${searchParams}${hash}` });
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
        <button
          data-testid="locale-en"
          onClick={() => handleLocaleChange('en')}
          style={{ fontWeight: locale === 'en' ? 'bold' : 'normal' }}
        >
          English
        </button>
        <button
          data-testid="locale-es"
          onClick={() => handleLocaleChange('es')}
          style={{ fontWeight: locale === 'es' ? 'bold' : 'normal' }}
        >
          Espanol
        </button>
      </div>
    </nav>
  );
}
