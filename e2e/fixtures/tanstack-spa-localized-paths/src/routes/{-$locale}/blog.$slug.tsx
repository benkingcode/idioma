import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/blog/$slug')({
  component: BlogPostPage,
});

function BlogPostPage() {
  const { slug } = Route.useParams();
  const t = useT();

  return (
    <div data-testid="blog-post-page">
      <h1 data-testid="blog-post-title">
        <Trans>Blog Post</Trans>
      </h1>
      <p data-testid="blog-post-slug">{slug}</p>
      <p data-testid="blog-post-description">
        {t('This is a blog post about {topic}', { topic: slug })}
      </p>
    </div>
  );
}
