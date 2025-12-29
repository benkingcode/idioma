import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/blog')({
  component: BlogPage,
});

function BlogPage() {
  const t = useT();

  return (
    <div data-testid="blog-page">
      <h1 data-testid="blog-title">
        <Trans>Our Blog</Trans>
      </h1>
      <p data-testid="blog-description">
        {t('Read our latest articles and updates')}
      </p>
    </div>
  );
}
