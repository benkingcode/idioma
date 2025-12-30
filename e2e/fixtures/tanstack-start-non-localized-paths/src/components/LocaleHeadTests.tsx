import { useLocation } from '@tanstack/react-router';
import { useLocale } from '../idiomi';

/**
 * Component for displaying LocaleHead metadata (for visual verification).
 * The actual <link> tags are rendered in <head> by LocaleHead component.
 */
export function LocaleHeadTests() {
  const locale = useLocale();
  const location = useLocation();

  return (
    <div data-testid="locale-head-tests">
      <h2>LocaleHead SEO Tests</h2>
      <dl>
        <dt>Current Locale:</dt>
        <dd data-testid="current-locale">{locale}</dd>

        <dt>Current Pathname:</dt>
        <dd data-testid="current-pathname">{location.pathname}</dd>
      </dl>

      <p>
        Check the document <code>&lt;head&gt;</code> for:
      </p>
      <ul>
        <li>
          <code>&lt;link rel="canonical" ...&gt;</code>
        </li>
        <li>
          <code>&lt;link rel="alternate" hreflang="en" ...&gt;</code>
        </li>
        <li>
          <code>&lt;link rel="alternate" hreflang="es" ...&gt;</code>
        </li>
        <li>
          <code>&lt;link rel="alternate" hreflang="x-default" ...&gt;</code>
        </li>
      </ul>
    </div>
  );
}
