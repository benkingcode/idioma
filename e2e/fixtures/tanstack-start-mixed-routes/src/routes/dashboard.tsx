import { createFileRoute, Link } from '@tanstack/react-router';
import { Trans, useLocale, useT } from '../idiomi';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const locale = useLocale();
  const t = useT();

  return (
    <>
      <nav
        data-testid="navigation"
        style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <Link to="/{-$locale}" params={{ locale }} data-testid="nav-home">
          Home
        </Link>
        <Link to="/dashboard" data-testid="nav-dashboard">
          Dashboard
        </Link>
      </nav>
      <main data-testid="main-content">
        <h1 data-testid="dashboard-title">
          <Trans>Dashboard</Trans>
        </h1>
        <p data-testid="dashboard-description">
          <Trans>
            This is a non-localized route that uses cookie detection.
          </Trans>
        </p>
        <p data-testid="dashboard-locale">
          {t('Current locale: {locale}', { locale })}
        </p>
      </main>
    </>
  );
}
