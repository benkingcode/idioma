import { Trans } from '@/idiomi';
import { Link } from '@/idiomi/client';

export default function BlogPage() {
  return (
    <div data-testid="blog-page">
      <h1>
        <Trans>Blog</Trans>
      </h1>
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
