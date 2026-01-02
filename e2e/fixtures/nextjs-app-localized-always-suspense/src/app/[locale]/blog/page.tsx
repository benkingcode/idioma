import { Trans } from '@/idiomi';
import { Link } from '@/idiomi/client';

export default function BlogPage() {
  return (
    <div data-testid="blog-page">
      <h1 data-testid="blog-title">
        <Trans>Our Blog</Trans>
      </h1>
      <p data-testid="blog-description">
        <Trans>Read our latest articles</Trans>
      </p>
      <ul>
        <li>
          <Link href="/blog/hello-world" data-testid="blog-post-link-hello">
            <Trans>Hello World Post</Trans>
          </Link>
        </li>
        <li>
          <Link
            href="/blog/getting-started"
            data-testid="blog-post-link-started"
          >
            <Trans>Getting Started</Trans>
          </Link>
        </li>
      </ul>
    </div>
  );
}
