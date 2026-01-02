import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: CI
    ? 'github'
    : [['json', { outputFile: 'playwright-results.json' }]],
  timeout: 10000,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // ============ SETUP PROJECTS ============
    // These start dev servers on-demand when their dependent tests run
    // Each setup test gets 2 minutes to start its server
    {
      name: 'setup:vite',
      testMatch: /setup\/vite\.setup\.ts$/,
      timeout: 120000,
    },
    {
      name: 'setup:tree-shaking',
      testMatch: /setup\/tree-shaking\.setup\.ts$/,
      timeout: 180000, // Extra time for build + preview
    },
    {
      name: 'setup:tanstack',
      testMatch: /setup\/tanstack\.setup\.ts$/,
      timeout: 120000,
    },
    {
      name: 'setup:nextjs-app',
      testMatch: /setup\/nextjs-app\.setup\.ts$/,
      timeout: 120000,
    },
    {
      name: 'setup:nextjs-pages',
      testMatch: /setup\/nextjs-pages\.setup\.ts$/,
      timeout: 120000,
    },

    // ============ VITE FIXTURES ============

    // Standard mode tests (non-Suspense)
    {
      name: 'standard',
      dependencies: ['setup:vite'],
      testIgnore: [
        /setup\/.*\.setup\.ts$/,
        /suspense\/.*\.spec\.ts$/,
        /tree-shaking\/.*\.spec\.ts$/,
        /routing\/.*\.spec\.ts$/,
        /nextjs-app\/.*\.spec\.ts$/,
        /nextjs-pages\/.*\.spec\.ts$/,
      ],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173',
      },
    },
    // Suspense mode tests
    {
      name: 'suspense',
      dependencies: ['setup:vite'],
      testMatch: /suspense\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5174',
      },
    },

    // ============ TREE-SHAKING FIXTURES ============

    // Tree-shaking tests - Suspense mode (production build)
    {
      name: 'tree-shaking-suspense',
      dependencies: ['setup:tree-shaking'],
      testMatch: /tree-shaking\/suspense\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5175',
      },
    },
    // Tree-shaking tests - Standard mode (production build)
    {
      name: 'tree-shaking-standard',
      dependencies: ['setup:tree-shaking'],
      testMatch: /tree-shaking\/standard\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5176',
      },
    },
    // ============ TANSTACK FIXTURES ============

    // TanStack Router SPA - Localized paths (route translation)
    {
      name: 'tanstack-spa-localized-paths',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5177',
      },
    },
    // TanStack Router SPA - Non-localized paths (prefix only)
    {
      name: 'tanstack-spa-non-localized-paths',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5178',
      },
    },
    // Shared routing tests - run on SPA localized paths fixture
    {
      name: 'tanstack-spa-localized-paths-shared',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5177',
      },
    },
    // Shared routing tests - run on SPA non-localized paths fixture
    {
      name: 'tanstack-spa-non-localized-paths-shared',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5178',
      },
    },
    // TanStack Start SSR - Localized paths (route translation)
    {
      name: 'tanstack-start-localized-paths',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5179',
      },
    },
    // TanStack Start SSR - Non-localized paths (prefix only)
    {
      name: 'tanstack-start-non-localized-paths',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5180',
      },
    },
    // Shared routing tests - run on SSR localized paths fixture
    {
      name: 'tanstack-start-localized-paths-shared',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5179',
      },
    },
    // Shared routing tests - run on SSR non-localized paths fixture
    {
      name: 'tanstack-start-non-localized-paths-shared',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5180',
      },
    },
    // SSR-specific tests - Accept-Language header detection (localized paths)
    {
      name: 'tanstack-start-localized-paths-ssr',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/ssr\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5179',
      },
    },
    // SSR-specific tests - Accept-Language header detection (non-localized paths)
    {
      name: 'tanstack-start-non-localized-paths-ssr',
      dependencies: ['setup:tanstack'],
      testMatch: /routing\/ssr\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5180',
      },
    },
    // TanStack Start SSR - Mixed routes (localized + non-localized)
    {
      name: 'tanstack-start-mixed-routes',
      dependencies: ['setup:tanstack'],
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
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5182',
      },
    },
    // Shared routing tests - run on App Router localized as-needed fixture
    {
      name: 'nextjs-app-localized-as-needed-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5182',
      },
    },
    // Next.js App Router - Localized paths with always prefix
    {
      name: 'nextjs-app-localized-always',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5183',
      },
    },
    // Shared routing tests - run on App Router localized always fixture
    {
      name: 'nextjs-app-localized-always-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5183',
      },
    },
    // Next.js App Router - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-app-non-localized-as-needed',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5184',
      },
    },
    // Shared routing tests - run on App Router non-localized as-needed fixture
    {
      name: 'nextjs-app-non-localized-as-needed-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5184',
      },
    },
    // Next.js App Router - Non-localized paths with never prefix
    {
      name: 'nextjs-app-non-localized-never',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5185',
      },
    },
    // Shared routing tests - run on App Router non-localized never fixture
    {
      name: 'nextjs-app-non-localized-never-shared',
      dependencies: ['setup:nextjs-app'],
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
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5186',
      },
    },
    // Shared routing tests - run on Pages Router localized as-needed fixture
    {
      name: 'nextjs-pages-localized-as-needed-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5186',
      },
    },
    // Next.js Pages Router - Localized paths with always prefix
    {
      name: 'nextjs-pages-localized-always',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5187',
      },
    },
    // Shared routing tests - run on Pages Router localized always fixture
    {
      name: 'nextjs-pages-localized-always-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5187',
      },
    },
    // Next.js Pages Router - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-pages-non-localized-as-needed',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5188',
      },
    },
    // Shared routing tests - run on Pages Router non-localized as-needed fixture
    {
      name: 'nextjs-pages-non-localized-as-needed-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5188',
      },
    },
    // Next.js Pages Router - Non-localized paths with never prefix
    {
      name: 'nextjs-pages-non-localized-never',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5189',
      },
    },
    // Shared routing tests - run on Pages Router non-localized never fixture
    {
      name: 'nextjs-pages-non-localized-never-shared',
      dependencies: ['setup:nextjs-pages'],
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
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/prefix-strategies\/as-needed\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5182',
      },
    },
    // App Router - always strategy tests (run on localized-always fixture)
    {
      name: 'nextjs-app-prefix-always',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/prefix-strategies\/always\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5183',
      },
    },
    // App Router - never strategy tests (run on non-localized-never fixture)
    {
      name: 'nextjs-app-prefix-never',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/prefix-strategies\/never\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5185',
      },
    },
    // Pages Router - as-needed strategy tests
    {
      name: 'nextjs-pages-prefix-as-needed',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/prefix-strategies\/as-needed\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5186',
      },
    },
    // Pages Router - always strategy tests
    {
      name: 'nextjs-pages-prefix-always',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/prefix-strategies\/always\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5187',
      },
    },
    // Pages Router - never strategy tests
    {
      name: 'nextjs-pages-prefix-never',
      dependencies: ['setup:nextjs-pages'],
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
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5190',
      },
    },
    // Shared routing tests - run on App Router localized as-needed suspense fixture
    {
      name: 'nextjs-app-localized-as-needed-suspense-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5190',
      },
    },
    // Next.js App Router Suspense - Localized paths with always prefix
    {
      name: 'nextjs-app-localized-always-suspense',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5191',
      },
    },
    // Shared routing tests - run on App Router localized always suspense fixture
    {
      name: 'nextjs-app-localized-always-suspense-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5191',
      },
    },
    // Next.js App Router Suspense - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-app-non-localized-as-needed-suspense',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5192',
      },
    },
    // Shared routing tests - run on App Router non-localized as-needed suspense fixture
    {
      name: 'nextjs-app-non-localized-as-needed-suspense-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5192',
      },
    },
    // Next.js App Router Suspense - Non-localized paths with never prefix
    {
      name: 'nextjs-app-non-localized-never-suspense',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5193',
      },
    },
    // Shared routing tests - run on App Router non-localized never suspense fixture
    {
      name: 'nextjs-app-non-localized-never-suspense-shared',
      dependencies: ['setup:nextjs-app'],
      testMatch: /nextjs-app\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5193',
      },
    },

    // Next.js Pages Router Suspense - Localized paths with as-needed prefix
    {
      name: 'nextjs-pages-localized-as-needed-suspense',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5194',
      },
    },
    // Shared routing tests - run on Pages Router localized as-needed suspense fixture
    {
      name: 'nextjs-pages-localized-as-needed-suspense-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5194',
      },
    },
    // Next.js Pages Router Suspense - Localized paths with always prefix
    {
      name: 'nextjs-pages-localized-always-suspense',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5195',
      },
    },
    // Shared routing tests - run on Pages Router localized always suspense fixture
    {
      name: 'nextjs-pages-localized-always-suspense-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5195',
      },
    },
    // Next.js Pages Router Suspense - Non-localized paths with as-needed prefix
    {
      name: 'nextjs-pages-non-localized-as-needed-suspense',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5196',
      },
    },
    // Shared routing tests - run on Pages Router non-localized as-needed suspense fixture
    {
      name: 'nextjs-pages-non-localized-as-needed-suspense-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5196',
      },
    },
    // Next.js Pages Router Suspense - Non-localized paths with never prefix
    {
      name: 'nextjs-pages-non-localized-never-suspense',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/non-localized-paths\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5197',
      },
    },
    // Shared routing tests - run on Pages Router non-localized never suspense fixture
    {
      name: 'nextjs-pages-non-localized-never-suspense-shared',
      dependencies: ['setup:nextjs-pages'],
      testMatch: /nextjs-pages\/shared\/.*\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5197',
      },
    },
  ],

  // NOTE: webServer config removed - setup projects now handle server startup on-demand
  // When you run `--project=standard`, only setup:vite runs (starting ports 5173-5174)
  // When you run `--project=nextjs-app-*`, only setup:nextjs-app runs (starting ports 5182-5193)
  // See tests/setup/*.setup.ts for server startup logic
});
