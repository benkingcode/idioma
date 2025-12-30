import { createFileRoute } from '@tanstack/react-router';
import { Trans, useT } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/users/$userId')({
  component: UserProfile,
});

function UserProfile() {
  const { userId } = Route.useParams();
  const t = useT();

  return (
    <div data-testid="user-profile-page">
      <h1 data-testid="user-profile-title">
        <Trans>User Profile</Trans>
      </h1>
      <p data-testid="user-id">{userId}</p>
      <p data-testid="user-description">
        {t('Viewing profile for {user}', { user: userId })}
      </p>
    </div>
  );
}
