import { createFileRoute } from '@tanstack/react-router';
import { HookTests } from '../../components/HookTests';
import { LinkTests } from '../../components/LinkTests';
import { LocaleHeadTests } from '../../components/LocaleHeadTests';

export const Route = createFileRoute('/{-$locale}/tests')({
  component: TestsPage,
});

function TestsPage() {
  return (
    <div
      data-testid="tests-page"
      style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
    >
      <h1>Routing Integration Tests</h1>
      <LinkTests />
      <hr />
      <LocaleHeadTests />
      <hr />
      <HookTests />
    </div>
  );
}
