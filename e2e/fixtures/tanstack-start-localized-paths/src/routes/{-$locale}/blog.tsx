import {
  createFileRoute,
  Link,
  Outlet,
  useMatch,
} from '@tanstack/react-router';
import { Trans, useLocale, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/blog')({
  component: BlogLayout,
});

function BlogLayout() {
  // Check if we're on a child route (blog post)
  const childMatch = useMatch({
    from: '/{-$locale}/blog/$slug',
    shouldThrow: false,
  });

  // If on a child route, render the outlet
  if (childMatch) {
    return <Outlet />;
  }

  // Otherwise render the blog list
  return <BlogPage />;
}

function BlogPage() {
  const t = useT();
  const locale = useLocale();

  return (
    <div data-testid="blog-page">
      <h1 data-testid="blog-title">
        <Trans>Our Blog</Trans>
      </h1>
      <p data-testid="blog-description">
        {t('Read our latest articles and updates')}
      </p>
      <ul data-testid="blog-post-list">
        <li>
          <Link
            to="/{-$locale}/blog/$slug"
            params={{ locale, slug: 'hello-world' }}
            data-testid="blog-post-link-hello"
          >
            <Trans>Hello World</Trans>
          </Link>
        </li>
        <li>
          <Link
            to="/{-$locale}/blog/$slug"
            params={{ locale, slug: 'getting-started' }}
            data-testid="blog-post-link-getting-started"
          >
            <Trans>Getting Started</Trans>
          </Link>
        </li>
      </ul>
    </div>
  );
}
