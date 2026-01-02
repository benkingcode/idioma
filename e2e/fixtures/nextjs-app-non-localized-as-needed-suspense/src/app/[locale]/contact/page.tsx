import { Trans } from '@/idiomi';

export default function ContactPage() {
  return (
    <div data-testid="contact-page">
      <h1 data-testid="contact-title">
        <Trans>Contact us</Trans>
      </h1>
      <p>
        <Trans>Get in touch with our team.</Trans>
      </p>
    </div>
  );
}
