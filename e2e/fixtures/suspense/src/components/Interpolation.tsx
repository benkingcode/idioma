import { Trans } from '../idioma';

export function Interpolation() {
  const name = 'Alice';
  const firstName = 'Bob';
  const lastName = 'Smith';

  return (
    <div>
      {/* Simple placeholder */}
      <p data-testid="interp-simple">
        <Trans>Hello, {name}!</Trans>
      </p>

      {/* Multiple placeholders */}
      <p data-testid="interp-multiple">
        <Trans>
          Welcome, {firstName} {lastName}!
        </Trans>
      </p>

      {/* Placeholder with surrounding text */}
      <p data-testid="interp-surrounded">
        <Trans>Before {name} after</Trans>
      </p>

      {/* Numbers as values */}
      <p data-testid="interp-number">
        <Trans>You have {42} items</Trans>
      </p>
    </div>
  );
}
