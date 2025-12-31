import {
  useLocale,
  useLocalizedHref,
  useLocalizedPath,
} from '@idiomi/tanstack-react/hooks';
import { defaultLocale, prefixStrategy } from '../idiomi/.generated/config';
import { routes } from '../idiomi/.generated/routes';

// Build linkConfig for useLocalizedHref
const linkConfig = {
  routes,
  defaultLocale,
  prefixStrategy,
};

/**
 * Component for testing routing hooks with various paths.
 */
export function HookTests() {
  const locale = useLocale();

  // Test useLocalizedPath (pure path translation, no prefix)
  const aboutPath = useLocalizedPath('/about', routes);
  const blogPath = useLocalizedPath('/blog', routes);
  const contactPath = useLocalizedPath('/contact', routes);

  // Test useLocalizedHref (includes locale prefix based on strategy)
  const aboutHref = useLocalizedHref('/about', linkConfig);
  const blogHref = useLocalizedHref('/blog', linkConfig);
  const contactHref = useLocalizedHref('/contact', linkConfig);

  // Test with explicit locale override
  const aboutHrefEn = useLocalizedHref('/about', linkConfig, 'en');
  const aboutHrefEs = useLocalizedHref('/about', linkConfig, 'es');

  return (
    <div data-testid="hook-tests">
      <h2>Hook Tests (Current locale: {locale})</h2>

      <section>
        <h3>useLocalizedPath (path translation only)</h3>
        <dl>
          <dt>/about:</dt>
          <dd data-testid="path-about">{aboutPath}</dd>

          <dt>/blog:</dt>
          <dd data-testid="path-blog">{blogPath}</dd>

          <dt>/contact:</dt>
          <dd data-testid="path-contact">{contactPath}</dd>
        </dl>
      </section>

      <section>
        <h3>useLocalizedHref (with locale prefix)</h3>
        <dl>
          <dt>/about:</dt>
          <dd data-testid="href-about">{aboutHref}</dd>

          <dt>/blog:</dt>
          <dd data-testid="href-blog">{blogHref}</dd>

          <dt>/contact:</dt>
          <dd data-testid="href-contact">{contactHref}</dd>
        </dl>
      </section>

      <section>
        <h3>useLocalizedHref with locale override</h3>
        <dl>
          <dt>/about (en):</dt>
          <dd data-testid="href-about-en">{aboutHrefEn}</dd>

          <dt>/about (es):</dt>
          <dd data-testid="href-about-es">{aboutHrefEs}</dd>
        </dl>
      </section>
    </div>
  );
}
