import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? 'github' : 'list',
  timeout: 10000,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Standard mode tests (non-Suspense)
    {
      name: 'standard',
      testIgnore: [
        /suspense\/.*\.spec\.ts$/,
        /tree-shaking\/.*\.spec\.ts$/,
        /routing\/.*\.spec\.ts$/,
      ],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    // Suspense mode tests
    {
      name: 'suspense',
      testMatch: /suspense\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
    },
    // Tree-shaking tests - Suspense mode (production build)
    {
      name: 'tree-shaking-suspense',
      testMatch: /tree-shaking\/suspense\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175',
      },
    },
    // Tree-shaking tests - Standard mode (production build)
    {
      name: 'tree-shaking-standard',
      testMatch: /tree-shaking\/standard\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5176',
      },
    },
    // TanStack Router SPA - Localized paths (route translation)
    {
      name: 'tanstack-spa-localized-paths',
      testMatch: /routing\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5177',
      },
    },
    // TanStack Router SPA - Non-localized paths (prefix only)
    {
      name: 'tanstack-spa-non-localized-paths',
      testMatch: /routing\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5178',
      },
    },
    // Shared routing tests - run on SPA localized paths fixture
    {
      name: 'tanstack-spa-localized-paths-shared',
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5177',
      },
    },
    // Shared routing tests - run on SPA non-localized paths fixture
    {
      name: 'tanstack-spa-non-localized-paths-shared',
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5178',
      },
    },
    // TanStack Start SSR - Localized paths (route translation)
    {
      name: 'tanstack-start-localized-paths',
      testMatch: /routing\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5179',
      },
    },
    // TanStack Start SSR - Non-localized paths (prefix only)
    {
      name: 'tanstack-start-non-localized-paths',
      testMatch: /routing\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5180',
      },
    },
    // Shared routing tests - run on SSR localized paths fixture
    {
      name: 'tanstack-start-localized-paths-shared',
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5179',
      },
    },
    // Shared routing tests - run on SSR non-localized paths fixture
    {
      name: 'tanstack-start-non-localized-paths-shared',
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5180',
      },
    },
    // SSR-specific tests - Accept-Language header detection (localized paths)
    {
      name: 'tanstack-start-localized-paths-ssr',
      testMatch: /routing\/ssr\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5179',
      },
    },
    // SSR-specific tests - Accept-Language header detection (non-localized paths)
    {
      name: 'tanstack-start-non-localized-paths-ssr',
      testMatch: /routing\/ssr\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5180',
      },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter e2e-fixture-standard dev:fixture --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter e2e-fixture-suspense dev:fixture --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Tree-shaking fixtures use preview (production build) for accurate chunk analysis
    {
      command:
        'pnpm --filter e2e-fixture-tree-shaking-suspense build:fixture && pnpm --filter e2e-fixture-tree-shaking-suspense preview --port 5175',
      url: 'http://localhost:5175',
      reuseExistingServer: !CI,
      timeout: 180000,
    },
    {
      command:
        'pnpm --filter e2e-fixture-tree-shaking-standard build:fixture && pnpm --filter e2e-fixture-tree-shaking-standard preview --port 5176',
      url: 'http://localhost:5176',
      reuseExistingServer: !CI,
      timeout: 180000,
    },
    // TanStack Router SPA fixtures
    {
      command:
        'pnpm --filter e2e-fixture-tanstack-spa-localized-paths dev:fixture --port 5177 --strictPort',
      url: 'http://localhost:5177',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    {
      command:
        'pnpm --filter e2e-fixture-tanstack-spa-non-localized-paths dev:fixture --port 5178 --strictPort',
      url: 'http://localhost:5178',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // TanStack Start SSR fixtures
    {
      command:
        'pnpm --filter e2e-fixture-tanstack-start-localized-paths dev:fixture --port 5179 --strictPort',
      url: 'http://localhost:5179',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    {
      command:
        'pnpm --filter e2e-fixture-tanstack-start-non-localized-paths dev:fixture --port 5180 --strictPort',
      url: 'http://localhost:5180',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
  ],
});
