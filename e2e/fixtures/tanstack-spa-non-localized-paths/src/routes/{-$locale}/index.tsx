import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/')({
  component: HomePage,
});

function HomePage() {
  const t = useT();

  return (
    <div data-testid="home-page">
      <h1 data-testid="home-title">
        <Trans>Welcome to our website</Trans>
      </h1>
      <p data-testid="home-description">
        {t('This is the home page with non-localized paths routing')}
      </p>
    </div>
  );
}
