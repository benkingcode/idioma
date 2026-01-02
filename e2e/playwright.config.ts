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
        /nextjs-app\/.*\.spec\.ts$/,
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
    // TanStack Start SSR - Mixed routes (localized + non-localized)
    {
      name: 'tanstack-start-mixed-routes',
      testMatch: /routing\/mixed-routes\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5181',
      },
    },
    // ============ NEXT.JS APP ROUTER ============

    // Next.js App Router - Localized paths with as-needed prefix
    {
      name: 'nextjs-app-localized-as-needed',
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5182',
      },
    },
    // Shared routing tests - run on App Router localized as-needed fixture
    {
      name: 'nextjs-app-localized-as-needed-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5182',
      },
    },
    // Next.js App Router - Localized paths with always prefix
    {
      name: 'nextjs-app-localized-always',
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5183',
      },
    },
    // Shared routing tests - run on App Router localized always fixture
    {
      name: 'nextjs-app-localized-always-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5183',
      },
    },
    // Next.js App Router - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-app-non-localized-as-needed',
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5184',
      },
    },
    // Shared routing tests - run on App Router non-localized as-needed fixture
    {
      name: 'nextjs-app-non-localized-as-needed-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5184',
      },
    },
    // Next.js App Router - Non-localized paths with never prefix
    {
      name: 'nextjs-app-non-localized-never',
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5185',
      },
    },
    // Shared routing tests - run on App Router non-localized never fixture
    {
      name: 'nextjs-app-non-localized-never-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5185',
      },
    },

    // ============ NEXT.JS PAGES ROUTER ============

    // Next.js Pages Router - Localized paths with as-needed prefix
    {
      name: 'nextjs-pages-localized-as-needed',
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5186',
      },
    },
    // Shared routing tests - run on Pages Router localized as-needed fixture
    {
      name: 'nextjs-pages-localized-as-needed-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5186',
      },
    },
    // Next.js Pages Router - Localized paths with always prefix
    {
      name: 'nextjs-pages-localized-always',
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5187',
      },
    },
    // Shared routing tests - run on Pages Router localized always fixture
    {
      name: 'nextjs-pages-localized-always-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5187',
      },
    },
    // Next.js Pages Router - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-pages-non-localized-as-needed',
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5188',
      },
    },
    // Shared routing tests - run on Pages Router non-localized as-needed fixture
    {
      name: 'nextjs-pages-non-localized-as-needed-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5188',
      },
    },
    // Next.js Pages Router - Non-localized paths with never prefix
    {
      name: 'nextjs-pages-non-localized-never',
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5189',
      },
    },
    // Shared routing tests - run on Pages Router non-localized never fixture
    {
      name: 'nextjs-pages-non-localized-never-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5189',
      },
    },

    // ============ PREFIX STRATEGY TESTS ============

    // App Router - as-needed strategy tests (run on localized-as-needed fixture)
    {
      name: 'nextjs-app-prefix-as-needed',
      testMatch: /nextjs-app\/prefix-strategies\/as-needed\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5182',
      },
    },
    // App Router - always strategy tests (run on localized-always fixture)
    {
      name: 'nextjs-app-prefix-always',
      testMatch: /nextjs-app\/prefix-strategies\/always\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5183',
      },
    },
    // App Router - never strategy tests (run on non-localized-never fixture)
    {
      name: 'nextjs-app-prefix-never',
      testMatch: /nextjs-app\/prefix-strategies\/never\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5185',
      },
    },
    // Pages Router - as-needed strategy tests
    {
      name: 'nextjs-pages-prefix-as-needed',
      testMatch: /nextjs-pages\/prefix-strategies\/as-needed\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5186',
      },
    },
    // Pages Router - always strategy tests
    {
      name: 'nextjs-pages-prefix-always',
      testMatch: /nextjs-pages\/prefix-strategies\/always\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5187',
      },
    },
    // Pages Router - never strategy tests
    {
      name: 'nextjs-pages-prefix-never',
      testMatch: /nextjs-pages\/prefix-strategies\/never\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5189',
      },
    },

    // ============ NEXT.JS SUSPENSE MODE ============

    // Next.js App Router Suspense - Localized paths with as-needed prefix
    {
      name: 'nextjs-app-localized-as-needed-suspense',
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5190',
      },
    },
    // Shared routing tests - run on App Router localized as-needed suspense fixture
    {
      name: 'nextjs-app-localized-as-needed-suspense-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5190',
      },
    },
    // Next.js App Router Suspense - Localized paths with always prefix
    {
      name: 'nextjs-app-localized-always-suspense',
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5191',
      },
    },
    // Shared routing tests - run on App Router localized always suspense fixture
    {
      name: 'nextjs-app-localized-always-suspense-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5191',
      },
    },
    // Next.js App Router Suspense - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-app-non-localized-as-needed-suspense',
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5192',
      },
    },
    // Shared routing tests - run on App Router non-localized as-needed suspense fixture
    {
      name: 'nextjs-app-non-localized-as-needed-suspense-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5192',
      },
    },
    // Next.js App Router Suspense - Non-localized paths with never prefix
    {
      name: 'nextjs-app-non-localized-never-suspense',
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5193',
      },
    },
    // Shared routing tests - run on App Router non-localized never suspense fixture
    {
      name: 'nextjs-app-non-localized-never-suspense-shared',
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5193',
      },
    },

    // Next.js Pages Router Suspense - Localized paths with as-needed prefix
    {
      name: 'nextjs-pages-localized-as-needed-suspense',
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5194',
      },
    },
    // Shared routing tests - run on Pages Router localized as-needed suspense fixture
    {
      name: 'nextjs-pages-localized-as-needed-suspense-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5194',
      },
    },
    // Next.js Pages Router Suspense - Localized paths with always prefix
    {
      name: 'nextjs-pages-localized-always-suspense',
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5195',
      },
    },
    // Shared routing tests - run on Pages Router localized always suspense fixture
    {
      name: 'nextjs-pages-localized-always-suspense-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5195',
      },
    },
    // Next.js Pages Router Suspense - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-pages-non-localized-as-needed-suspense',
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5196',
      },
    },
    // Shared routing tests - run on Pages Router non-localized as-needed suspense fixture
    {
      name: 'nextjs-pages-non-localized-as-needed-suspense-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5196',
      },
    },
    // Next.js Pages Router Suspense - Non-localized paths with never prefix
    {
      name: 'nextjs-pages-non-localized-never-suspense',
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5197',
      },
    },
    // Shared routing tests - run on Pages Router non-localized never suspense fixture
    {
      name: 'nextjs-pages-non-localized-never-suspense-shared',
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5197',
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
    // TanStack Start SSR - Mixed routes fixture
    {
      command:
        'pnpm --filter e2e-fixture-tanstack-start-mixed-routes dev:fixture --port 5181 --strictPort',
      url: 'http://localhost:5181',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router - Localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-localized-as-needed dev:fixture --port 5182',
      url: 'http://localhost:5182',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router - Localized paths with always prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-localized-always dev:fixture --port 5183',
      url: 'http://localhost:5183',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router - Non-localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-non-localized-as-needed dev:fixture --port 5184',
      url: 'http://localhost:5184',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router - Non-localized paths with never prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-non-localized-never dev:fixture --port 5185',
      url: 'http://localhost:5185',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router - Localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-localized-as-needed dev:fixture --port 5186',
      url: 'http://localhost:5186',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router - Localized paths with always prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-localized-always dev:fixture --port 5187',
      url: 'http://localhost:5187',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router - Non-localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-non-localized-as-needed dev:fixture --port 5188',
      url: 'http://localhost:5188',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router - Non-localized paths with never prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-non-localized-never dev:fixture --port 5189',
      url: 'http://localhost:5189',
      reuseExistingServer: !CI,
      timeout: 120000,
    },

    // ============ NEXT.JS SUSPENSE MODE ============

    // Next.js App Router Suspense - Localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-localized-as-needed-suspense dev:fixture --port 5190',
      url: 'http://localhost:5190',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router Suspense - Localized paths with always prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-localized-always-suspense dev:fixture --port 5191',
      url: 'http://localhost:5191',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router Suspense - Non-localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-non-localized-as-needed-suspense dev:fixture --port 5192',
      url: 'http://localhost:5192',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js App Router Suspense - Non-localized paths with never prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-app-non-localized-never-suspense dev:fixture --port 5193',
      url: 'http://localhost:5193',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router Suspense - Localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-localized-as-needed-suspense dev:fixture --port 5194',
      url: 'http://localhost:5194',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router Suspense - Localized paths with always prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-localized-always-suspense dev:fixture --port 5195',
      url: 'http://localhost:5195',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router Suspense - Non-localized paths with as-needed prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-non-localized-as-needed-suspense dev:fixture --port 5196',
      url: 'http://localhost:5196',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
    // Next.js Pages Router Suspense - Non-localized paths with never prefix
    {
      command:
        'pnpm --filter e2e-fixture-nextjs-pages-non-localized-never-suspense dev:fixture --port 5197',
      url: 'http://localhost:5197',
      reuseExistingServer: !CI,
      timeout: 120000,
    },
  ],
});
