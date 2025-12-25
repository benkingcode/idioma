import { Trans, useT } from '../idioma';

export function EdgeCases() {
  const t = useT();

  // Edge case values
  const emptyString = '';
  const zero = 0;
  const nullValue = null;

  return (
    <div>
      {/* Empty string value */}
      <p data-testid="edge-empty">
        <Trans>Value: [{emptyString}]</Trans>
      </p>

      {/* Zero value (falsy but valid) */}
      <p data-testid="edge-zero">
        <Trans>Count: {zero}</Trans>
      </p>

      {/* Null value */}
      <p data-testid="edge-null">
        <Trans>Null: [{nullValue}]</Trans>
      </p>

      {/* Missing translation (tests fallback) */}
      <p data-testid="edge-fallback">
        <Trans>This message might not be translated</Trans>
      </p>

      {/* Long text */}
      <p data-testid="edge-long">
        <Trans>
          This is a longer piece of text that spans multiple words and tests how
          the system handles longer content in translations
        </Trans>
      </p>

      {/* Special characters */}
      <p data-testid="edge-special">
        <Trans>Special: &amp; &lt; &gt; "quotes"</Trans>
      </p>

      {/* useT with missing placeholder */}
      <p data-testid="edge-missing-placeholder">{t('Hello {name}!')}</p>

      {/* Unicode characters */}
      <p data-testid="edge-unicode">
        <Trans>Emoji: 🎉 and symbols: © ® ™</Trans>
      </p>
    </div>
  );
}
