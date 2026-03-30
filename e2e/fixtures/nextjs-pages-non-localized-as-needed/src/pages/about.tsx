import { Navigation } from '@/components/Navigation';
import { Trans } from '@/idiomi/client';
import { LocaleHead } from '@/idiomi/client';

export default function AboutPage() {
  return (
    <main data-testid="about-page">
      <LocaleHead />
      <Navigation />
      <h1 data-testid="about-title">
        <Trans>About our company</Trans>
      </h1>
      <p data-testid="about-description">
        <Trans>Learn more about what we do.</Trans>
      </p>
    </main>
  );
}
