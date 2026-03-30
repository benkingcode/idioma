import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/contact')({
  component: ContactPage,
});

function ContactPage() {
  const t = useT();

  return (
    <div data-testid="contact-page">
      <h1 data-testid="contact-title">
        <Trans>Get in touch with us</Trans>
      </h1>
      <p data-testid="contact-description">
        {t('Send us a message and we will respond')}
      </p>
    </div>
  );
}
