import { Trans } from '../idioma';

export function BasicTrans() {
  return (
    <div>
      {/* Simple static text */}
      <p data-testid="basic-hello">
        <Trans>Hello, World!</Trans>
      </p>

      {/* Another simple message */}
      <p data-testid="basic-welcome">
        <Trans>Welcome to our application</Trans>
      </p>

      {/* Message with explicit ID */}
      <p data-testid="basic-explicit-id">
        <Trans id="greeting.farewell">Goodbye!</Trans>
      </p>
    </div>
  );
}
