import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI ? 'github' : 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Standard mode tests (non-Suspense)
    {
      name: 'standard',
      testIgnore: /suspense\/.*\.spec\.ts$/,
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
  ],

  webServer: [
    {
      command: 'pnpm --filter e2e-fixture-standard dev --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter e2e-fixture-suspense dev --port 5174',
      url: 'http://localhost:5174',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
  ],
});
