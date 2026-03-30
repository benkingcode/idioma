import { test as setup } from '@playwright/test';
import { ensureServer } from '../../helpers/server';

// TanStack Router SPA fixtures
setup('start tanstack-spa-localized-paths', async () => {
  await ensureServer({
    filter: 'e2e-fixture-tanstack-spa-localized-paths',
    port: 5177,
    extraArgs: ['--strictPort'],
  });
});

setup('start tanstack-spa-non-localized-paths', async () => {
  await ensureServer({
    filter: 'e2e-fixture-tanstack-spa-non-localized-paths',
    port: 5178,
    extraArgs: ['--strictPort'],
  });
});

// TanStack Start SSR fixtures
setup('start tanstack-start-localized-paths', async () => {
  await ensureServer({
    filter: 'e2e-fixture-tanstack-start-localized-paths',
    port: 5179,
    extraArgs: ['--strictPort'],
  });
});

setup('start tanstack-start-non-localized-paths', async () => {
  await ensureServer({
    filter: 'e2e-fixture-tanstack-start-non-localized-paths',
    port: 5180,
    extraArgs: ['--strictPort'],
  });
});

setup('start tanstack-start-mixed-routes', async () => {
  await ensureServer({
    filter: 'e2e-fixture-tanstack-start-mixed-routes',
    port: 5181,
    extraArgs: ['--strictPort'],
  });
});
