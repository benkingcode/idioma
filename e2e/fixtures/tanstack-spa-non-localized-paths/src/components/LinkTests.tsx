import { Link, useLocale } from '../idiomi';

/**
 * Component for testing Link behavior with various props.
 * Each link has a data-testid for E2E testing.
 */
export function LinkTests() {
  const locale = useLocale();

  return (
    <div data-testid="link-tests">
      <h2>Link Tests (Current locale: {locale})</h2>

      {/* Basic links using context locale */}
      <section data-testid="context-locale-links">
        <h3>Links using context locale</h3>
        <ul>
          <li>
            <Link to="/" data-testid="link-home">
              Home
            </Link>
          </li>
          <li>
            <Link to="/about" data-testid="link-about">
              About
            </Link>
          </li>
          <li>
            <Link to="/blog" data-testid="link-blog">
              Blog
            </Link>
          </li>
          <li>
            <Link to="/contact" data-testid="link-contact">
              Contact
            </Link>
          </li>
        </ul>
      </section>

      {/* Links with explicit locale prop */}
      <section data-testid="explicit-locale-links">
        <h3>Links with explicit locale</h3>
        <ul>
          <li>
            <Link to="/about" locale="en" data-testid="link-about-en">
              About (EN)
            </Link>
          </li>
          <li>
            <Link to="/about" locale="es" data-testid="link-about-es">
              About (ES)
            </Link>
          </li>
          <li>
            <Link to="/blog" locale="en" data-testid="link-blog-en">
              Blog (EN)
            </Link>
          </li>
          <li>
            <Link to="/blog" locale="es" data-testid="link-blog-es">
              Blog (ES)
            </Link>
          </li>
        </ul>
      </section>

      {/* Language switcher pattern */}
      <section data-testid="language-switcher">
        <h3>Language Switcher</h3>
        <Link to="/about" locale="en" data-testid="switcher-en">
          English
        </Link>
        {' | '}
        <Link to="/about" locale="es" data-testid="switcher-es">
          Espanol
        </Link>
      </section>
    </div>
  );
}
