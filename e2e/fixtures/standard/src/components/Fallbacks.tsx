import { useT } from '../idioma';

/**
 * A key used only through t({ id }) has no source text to extract, so its
 * source-locale msgstr can be empty while another locale has a translation.
 * It must render its id there, never the other locale's text (issue #8).
 */
export function Fallbacks() {
  const t = useT();

  return (
    <div>
      <p data-testid="fallback-spanish-only">
        {t({ id: 'fallback.spanishOnly' })}
      </p>
    </div>
  );
}
