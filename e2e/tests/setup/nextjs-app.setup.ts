import { test as setup } from '@playwright/test';
import { ensureServer } from '../../helpers/server';

// Next.js App Router - Standard mode fixtures
setup('start nextjs-app-localized-as-needed', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-localized-as-needed',
    port: 5182,
  });
});

setup('start nextjs-app-localized-always', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-localized-always',
    port: 5183,
  });
});

setup('start nextjs-app-non-localized-as-needed', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-non-localized-as-needed',
    port: 5184,
  });
});

setup('start nextjs-app-non-localized-never', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-non-localized-never',
    port: 5185,
  });
});

// Next.js App Router - Suspense mode fixtures
setup('start nextjs-app-localized-as-needed-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-localized-as-needed-suspense',
    port: 5190,
  });
});

setup('start nextjs-app-localized-always-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-localized-always-suspense',
    port: 5191,
  });
});

setup('start nextjs-app-non-localized-as-needed-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-non-localized-as-needed-suspense',
    port: 5192,
  });
});

setup('start nextjs-app-non-localized-never-suspense', async () => {
  await ensureServer({
    filter: 'e2e-fixture-nextjs-app-non-localized-never-suspense',
    port: 5193,
  });
});
