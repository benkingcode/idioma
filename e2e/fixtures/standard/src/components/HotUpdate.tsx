import { Trans } from '../idioma';

/**
 * A message only the dev-mode hot update spec reads. It is in its own
 * namespace, locales/{locale}/hot.po, so the spec's PO edit cannot disturb
 * other specs running at the same time (the no-op edit spec watches the
 * flat PO files).
 */
export function HotUpdate() {
  return (
    <p data-testid="hot-message">
      <Trans id="hot.message" ns="hot">
        Hot message
      </Trans>
    </p>
  );
}
