import { Navigation } from '@/components/Navigation';
import { Trans } from '@/idiomi/client';
import { LocaleHead } from '@/idiomi/client';

export default function ContactPage() {
  return (
    <main data-testid="contact-page">
      <LocaleHead />
      <Navigation />
      <h1 data-testid="contact-title">
        <Trans>Contact Us</Trans>
      </h1>
      <p data-testid="contact-description">
        <Trans>Get in touch with our team.</Trans>
      </p>
    </main>
  );
}
