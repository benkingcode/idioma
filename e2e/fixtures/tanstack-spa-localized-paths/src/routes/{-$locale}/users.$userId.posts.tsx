import {
  createFileRoute,
  Link,
  Outlet,
  useMatch,
} from '@tanstack/react-router';
import { Trans, useLocale, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/users/$userId/posts')({
  component: UserPostsLayout,
});

function UserPostsLayout() {
  // Check if we're on a child route (post detail)
  const childMatch = useMatch({
    from: '/{-$locale}/users/$userId/posts/$postId',
    shouldThrow: false,
  });

  // If on a child route, render the outlet
  if (childMatch) {
    return <Outlet />;
  }

  // Otherwise render the posts list
  return <UserPostsPage />;
}

function UserPostsPage() {
  const { userId } = Route.useParams();
  const locale = useLocale();
  const t = useT();

  return (
    <div data-testid="user-posts-page">
      <h1 data-testid="user-posts-title">
        <Trans>User Posts</Trans>
      </h1>
      <p data-testid="user-posts-user-id">{userId}</p>
      <p data-testid="user-posts-description">
        {t('Posts by {user}', { user: userId })}
      </p>
      <ul data-testid="user-posts-list">
        <li>
          <Link
            to="/{-$locale}/users/$userId/posts/$postId"
            params={{ locale, userId, postId: 'first-post' }}
            data-testid="post-link-first"
          >
            <Trans>First Post</Trans>
          </Link>
        </li>
        <li>
          <Link
            to="/{-$locale}/users/$userId/posts/$postId"
            params={{ locale, userId, postId: 'second-post' }}
            data-testid="post-link-second"
          >
            <Trans>Second Post</Trans>
          </Link>
        </li>
      </ul>
    </div>
  );
}
