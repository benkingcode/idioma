import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/users/$userId/posts/$postId')(
  {
    component: UserPostDetail,
  },
);

function UserPostDetail() {
  const { userId, postId } = Route.useParams();
  const t = useT();

  return (
    <div data-testid="user-post-detail-page">
      <h1 data-testid="user-post-detail-title">
        <Trans>Post Detail</Trans>
      </h1>
      <p data-testid="detail-user-id">{userId}</p>
      <p data-testid="detail-post-id">{postId}</p>
      <p data-testid="user-post-detail-description">
        {t('Post {postId} by {userId}', { postId, userId })}
      </p>
    </div>
  );
}
