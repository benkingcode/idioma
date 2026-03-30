import { Trans } from '@/idiomi/client';

export default function HomePage() {
  return (
    <div data-testid="home-page">
      <h1 data-testid="home-title">
        <Trans>Welcome to our website</Trans>
      </h1>
      <p>
        <Trans>
          This is a demonstration of Idiomi with Next.js App Router.
        </Trans>
      </p>
    </div>
  );
}
