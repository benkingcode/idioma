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
      testIgnore: [/suspense\/.*\.spec\.ts$/, /tree-shaking\/.*\.spec\.ts$/],
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
  ],
});
