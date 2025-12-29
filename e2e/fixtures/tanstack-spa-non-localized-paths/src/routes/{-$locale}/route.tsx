import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import {
  detectClientLocale,
  IdiomiProvider,
  Link,
  LocaleHead,
  localeLoader,
  useLocale,
} from '../../idiomi';
import type { Locale } from '../../idiomi';

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

    // Get current path without locale prefix (no path translation needed)
    const currentPath = window.location.pathname;
    const pathWithoutLocale = currentPath.replace(/^\/(en|es)/, '') || '/';

    // Build new URL with locale prefix (if needed)
    const newPath =
      newLocale === 'en'
        ? pathWithoutLocale
        : `/${newLocale}${pathWithoutLocale}`;

    navigate({ to: newPath });
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
      <Link to="/" data-testid="nav-home">
        Home
      </Link>
      <Link to="/about" data-testid="nav-about">
        About
      </Link>
      <Link to="/blog" data-testid="nav-blog">
        Blog
      </Link>
      <Link to="/contact" data-testid="nav-contact">
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
