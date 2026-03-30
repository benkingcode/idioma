import { Trans } from '@/idiomi/client';

export default function AboutPage() {
  return (
    <div data-testid="about-page">
      <h1 data-testid="about-title">
        <Trans>About our company</Trans>
      </h1>
      <p data-testid="about-description">
        <Trans>We are building the future of internationalization.</Trans>
      </p>
    </div>
  );
}
