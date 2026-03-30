import { createLazyFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../idiomi';

export const Route = createLazyFileRoute('/about')({
  component: AboutPage,
});

function AboutPage() {
  const t = useT();

  return (
    <div data-testid="about-page">
      <h1 data-testid="about-title">
        <Trans>About our company</Trans>
      </h1>
      <p data-testid="about-description">{t('Learn more about what we do')}</p>
    </div>
  );
}
