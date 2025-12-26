import { createLazyFileRoute } from '@tanstack/react-router';
import { Trans } from '../idioma';

export const Route = createLazyFileRoute('/contact')({
  component: ContactPage,
});

function ContactPage() {
  return (
    <div data-testid="contact-page">
      <h1 data-testid="contact-title">
        <Trans>Get in touch with us</Trans>
      </h1>
      <p data-testid="contact-description">
        <Trans>Send us a message and we will respond</Trans>
      </p>
    </div>
  );
}
