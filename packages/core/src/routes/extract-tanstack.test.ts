import { promises as fs } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractTanStackRoutes } from './extract-tanstack.js';

// Test fixture paths
const fixtureRoot = join(__dirname, '__fixtures__', 'tanstack');

describe('extractTanStackRoutes', () => {
  beforeEach(async () => {
    // Create fixture directories
    await fs.mkdir(join(fixtureRoot, 'src', 'routes'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up fixture directories
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  describe('file-based routing', () => {
    it('extracts routes from routes/ directory', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'index.tsx'),
        'export const Route = createFileRoute("/")({ component: Home })',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'about.tsx'),
        'export const Route = createFileRoute("/about")({ component: About })',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/',
          segments: [],
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/about',
          segments: ['about'],
        }),
      );
    });

    it('handles dynamic segments ($param)', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'blog.$slug.tsx'),
        'export const Route = createFileRoute("/blog/$slug")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      // TanStack's $slug should be normalized to [slug]
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog/[slug]',
          segments: ['blog', '[slug]'],
        }),
      );
    });

    it('handles nested file naming convention', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'blog.index.tsx'),
        'export const Route = createFileRoute("/blog")({})',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'blog.$postId.tsx'),
        'export const Route = createFileRoute("/blog/$postId")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog',
          segments: ['blog'],
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog/[postId]',
          segments: ['blog', '[postId]'],
        }),
      );
    });

    it('skips layout files (_layout, __root)', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', '__root.tsx'),
        'export const Route = createRootRoute()({})',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', '_layout.tsx'),
        'export const Route = createFileRoute("/_layout")({})',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'about.tsx'),
        'export const Route = createFileRoute("/about")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/__root' }),
      );
      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/_layout' }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/about' }),
      );
    });

    it('skips pathless layout files (trailing underscore)', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'dashboard_.tsx'),
        'export const Route = createFileRoute("/dashboard_")({})',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'about.tsx'),
        'export const Route = createFileRoute("/about")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/dashboard_' }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/about' }),
      );
    });

    it('handles route groups (parentheses)', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', '(auth).login.tsx'),
        'export const Route = createFileRoute("/(auth)/login")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      // Route group should be ignored in path
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/login',
          segments: ['login'],
        }),
      );
    });

    it('filters out $lang segment when first', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', '$lang.about.tsx'),
        'export const Route = createFileRoute("/$lang/about")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/about',
          segments: ['about'],
        }),
      );
    });
  });

  describe('createFileRoute fallback extraction', () => {
    it('extracts routes from createFileRoute calls in source', async () => {
      // Put source file outside routes/ directory
      await fs.writeFile(
        join(fixtureRoot, 'src', 'custom-routes.tsx'),
        `
        import { createFileRoute } from '@tanstack/react-router';

        export const Route1 = createFileRoute('/dashboard')({ component: Dashboard });
        export const Route2 = createFileRoute('/settings')({ component: Settings });
        `,
      );

      // Remove routes directory
      await fs.rm(join(fixtureRoot, 'src', 'routes'), {
        recursive: true,
        force: true,
      });

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/dashboard',
          segments: ['dashboard'],
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/settings',
          segments: ['settings'],
        }),
      );
    });

    it('normalizes $param to [param] in createFileRoute paths', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'custom-routes.tsx'),
        `
        import { createFileRoute } from '@tanstack/react-router';
        export const Route = createFileRoute('/users/$userId')({ component: User });
        `,
      );

      await fs.rm(join(fixtureRoot, 'src', 'routes'), {
        recursive: true,
        force: true,
      });

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/users/[userId]',
          segments: ['users', '[userId]'],
        }),
      );
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no routes found', async () => {
      await fs.rm(join(fixtureRoot, 'src', 'routes'), {
        recursive: true,
        force: true,
      });

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      expect(routes).toEqual([]);
    });

    it('deduplicates routes with same path', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'about.tsx'),
        'export const Route = createFileRoute("/about")({})',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'about.ts'),
        'export const Route = createFileRoute("/about")({})',
      );

      const routes = await extractTanStackRoutes({ projectRoot: fixtureRoot });

      const aboutRoutes = routes.filter((r) => r.path === '/about');
      expect(aboutRoutes).toHaveLength(1);
    });

    it('respects exclude patterns', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'about.tsx'),
        'export const Route = createFileRoute("/about")({})',
      );
      await fs.writeFile(
        join(fixtureRoot, 'src', 'routes', 'admin.tsx'),
        'export const Route = createFileRoute("/admin")({})',
      );

      const routes = await extractTanStackRoutes({
        projectRoot: fixtureRoot,
        exclude: ['**/admin*'],
      });

      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/admin' }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/about' }),
      );
    });
  });
});
