import { createFileRoute } from '@tanstack/react-router';
import { Trans } from '../../idiomi';

export const Route = createFileRoute('/{-$locale}/docs/api/v2/reference')({
  component: DocsReference,
});

function DocsReference() {
  return (
    <div data-testid="docs-reference-page">
      <h1 data-testid="docs-reference-title">
        <Trans>API Reference</Trans>
      </h1>
      <p data-testid="docs-reference-version">v2</p>
      <p data-testid="docs-reference-description">
        <Trans>Complete API documentation</Trans>
      </p>
    </div>
  );
}
