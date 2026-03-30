import { promises as fs } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractNextjsRoutes } from './extract-nextjs.js';

// Test fixture paths
const fixtureRoot = join(__dirname, '__fixtures__', 'nextjs');

describe('extractNextjsRoutes', () => {
  beforeEach(async () => {
    // Create fixture directories
    await fs.mkdir(join(fixtureRoot, 'app', 'about'), { recursive: true });
    await fs.mkdir(join(fixtureRoot, 'app', 'blog', '[slug]'), {
      recursive: true,
    });
    await fs.mkdir(join(fixtureRoot, 'app', '(marketing)', 'pricing'), {
      recursive: true,
    });
    await fs.mkdir(join(fixtureRoot, 'app', '[lang]', 'contact'), {
      recursive: true,
    });
  });

  afterEach(async () => {
    // Clean up fixture directories
    await fs.rm(fixtureRoot, { recursive: true, force: true });
  });

  describe('App Router extraction', () => {
    it('extracts routes from app/ directory', async () => {
      // Create test files
      await fs.writeFile(
        join(fixtureRoot, 'app', 'page.tsx'),
        'export default function Home() {}',
      );
      await fs.writeFile(
        join(fixtureRoot, 'app', 'about', 'page.tsx'),
        'export default function About() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/',
          segments: [],
          type: 'page',
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/about',
          segments: ['about'],
          type: 'page',
        }),
      );
    });

    it('handles dynamic segments', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'app', 'blog', '[slug]', 'page.tsx'),
        'export default function BlogPost() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog/[slug]',
          segments: ['blog', '[slug]'],
        }),
      );
    });

    it('ignores route groups in path', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'app', '(marketing)', 'pricing', 'page.tsx'),
        'export default function Pricing() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/pricing',
          segments: ['pricing'],
        }),
      );
    });

    it('filters out [lang] segment when first', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'app', '[lang]', 'contact', 'page.tsx'),
        'export default function Contact() {}',
      );

      const routes = await extractNextjsRoutes({
        projectRoot: fixtureRoot,
        localeParamName: 'lang',
      });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/contact',
          segments: ['contact'],
        }),
      );
    });

    it('extracts route handlers', async () => {
      await fs.mkdir(join(fixtureRoot, 'app', 'api', 'users'), {
        recursive: true,
      });
      await fs.writeFile(
        join(fixtureRoot, 'app', 'api', 'users', 'route.ts'),
        'export function GET() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/api/users',
          type: 'route',
        }),
      );
    });

    it('respects exclude patterns', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'app', 'about', 'page.tsx'),
        'export default function About() {}',
      );

      const routes = await extractNextjsRoutes({
        projectRoot: fixtureRoot,
        exclude: ['**/about/**'],
      });

      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/about' }),
      );
    });
  });

  describe('Pages Router extraction', () => {
    beforeEach(async () => {
      await fs.mkdir(join(fixtureRoot, 'pages', 'blog'), { recursive: true });
      // Remove app dir to test pages router
      await fs.rm(join(fixtureRoot, 'app'), { recursive: true, force: true });
    });

    it('extracts routes from pages/ directory', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'pages', 'index.tsx'),
        'export default function Home() {}',
      );
      await fs.writeFile(
        join(fixtureRoot, 'pages', 'about.tsx'),
        'export default function About() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

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

    it('handles nested pages', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'pages', 'blog', 'index.tsx'),
        'export default function Blog() {}',
      );
      await fs.writeFile(
        join(fixtureRoot, 'pages', 'blog', '[slug].tsx'),
        'export default function BlogPost() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog',
          segments: ['blog'],
        }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({
          path: '/blog/[slug]',
          segments: ['blog', '[slug]'],
        }),
      );
    });

    it('skips special files (_app, _document)', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'pages', '_app.tsx'),
        'export default function App() {}',
      );
      await fs.writeFile(
        join(fixtureRoot, 'pages', '_document.tsx'),
        'export default function Document() {}',
      );
      await fs.writeFile(
        join(fixtureRoot, 'pages', 'about.tsx'),
        'export default function About() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/_app' }),
      );
      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/_document' }),
      );
      expect(routes).toContainEqual(
        expect.objectContaining({ path: '/about' }),
      );
    });

    it('skips api routes by default', async () => {
      await fs.mkdir(join(fixtureRoot, 'pages', 'api'), { recursive: true });
      await fs.writeFile(
        join(fixtureRoot, 'pages', 'api', 'users.ts'),
        'export default function handler() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).not.toContainEqual(
        expect.objectContaining({ path: '/api/users' }),
      );
    });
  });

  describe('edge cases', () => {
    it('returns empty array when no routes found', async () => {
      await fs.rm(join(fixtureRoot, 'app'), { recursive: true, force: true });

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      expect(routes).toEqual([]);
    });

    it('deduplicates routes with same path', async () => {
      await fs.writeFile(
        join(fixtureRoot, 'app', 'about', 'page.tsx'),
        'export default function About() {}',
      );
      await fs.writeFile(
        join(fixtureRoot, 'app', 'about', 'page.ts'),
        'export default function About() {}',
      );

      const routes = await extractNextjsRoutes({ projectRoot: fixtureRoot });

      const aboutRoutes = routes.filter((r) => r.path === '/about');
      expect(aboutRoutes).toHaveLength(1);
    });
  });
});
