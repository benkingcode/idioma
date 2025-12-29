import { createLazyFileRoute } from '@tanstack/react-router';
import { Trans } from '../idiomi';

export const Route = createLazyFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div data-testid="home-page">
      <h1 data-testid="home-title">
        <Trans>Welcome to our website</Trans>
      </h1>
      <p data-testid="home-description">
        <Trans>This is the home page with unique translations</Trans>
      </p>
    </div>
  );
}
