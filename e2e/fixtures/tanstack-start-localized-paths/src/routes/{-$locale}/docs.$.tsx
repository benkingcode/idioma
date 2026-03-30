import { createFileRoute } from '@tanstack/react-router';
import { Trans } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/docs/$')({
  component: DocsPage,
});

function DocsPage() {
  const { _splat } = Route.useParams();

  return (
    <div data-testid="docs-page">
      <h1 data-testid="docs-title">
        <Trans>Documentation</Trans>
      </h1>
      <p data-testid="docs-path">
        Path: <code data-testid="docs-splat">{_splat}</code>
      </p>
    </div>
  );
}
