import { Trans } from '@/idiomi';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div data-testid="home-page">
      <h1>
        <Trans>Welcome to Idiomi</Trans>
      </h1>
      <nav>
        {/* TODO: Replace with Idiomi Link after Phase 5 */}
        <Link href="/blog" data-testid="nav-blog">
          <Trans>Blog</Trans>
        </Link>
      </nav>
    </div>
  );
}
