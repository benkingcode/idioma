import { Navigation } from '@/components/Navigation';
import { Trans } from '@/idiomi';
import { LocaleHead } from '@/idiomi/client';

export default function HomePage() {
  return (
    <main data-testid="home-page">
      <LocaleHead />
      <Navigation />
      <h1 data-testid="home-title">
        <Trans>Welcome to our website</Trans>
      </h1>
      <p data-testid="home-description">
        <Trans>This is the home page content.</Trans>
      </p>
    </main>
  );
}
