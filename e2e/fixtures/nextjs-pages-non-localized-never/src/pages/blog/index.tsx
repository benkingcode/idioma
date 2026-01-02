import { Navigation } from '@/components/Navigation';
import { Trans } from '@/idiomi/client';
import { Link, LocaleHead } from '@/idiomi/client';

const posts = [
  { slug: 'hello-world', title: 'Hello World' },
  { slug: 'second-post', title: 'Second Post' },
];

export default function BlogPage() {
  return (
    <main data-testid="blog-page">
      <LocaleHead />
      <Navigation />
      <h1 data-testid="blog-title">
        <Trans>Our Blog</Trans>
      </h1>
      <ul data-testid="blog-list">
        {posts.map((post) => (
          <li key={post.slug} data-testid={`blog-post-${post.slug}`}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
