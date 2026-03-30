import { promises as fs } from 'fs';
import { join, relative } from 'path';
import fg from 'fast-glob';
import type { ExtractedRoute, ExtractRoutesOptions } from './types.js';
import { isRouteGroup } from './types.js';

/**
 * Extract routes from a Next.js project.
 *
 * Supports both App Router (app/) and Pages Router (pages/).
 * Returns normalized route paths with their segments.
 */
export async function extractNextjsRoutes(
  options: ExtractRoutesOptions,
): Promise<ExtractedRoute[]> {
  const { projectRoot, exclude = [], localeParamName = 'locale' } = options;

  // Check for app/ and pages/ directories
  const appDir = join(projectRoot, 'app');
  const srcAppDir = join(projectRoot, 'src', 'app');
  const pagesDir = join(projectRoot, 'pages');
  const srcPagesDir = join(projectRoot, 'src', 'pages');

  const routes: ExtractedRoute[] = [];

  // Try App Router first (takes precedence if both exist)
  for (const dir of [appDir, srcAppDir]) {
    if (await directoryExists(dir)) {
      const appRoutes = await extractAppRouterRoutes(
        dir,
        projectRoot,
        exclude,
        localeParamName,
      );
      routes.push(...appRoutes);
      break; // Only use one app directory
    }
  }

  // Try Pages Router
  for (const dir of [pagesDir, srcPagesDir]) {
    if (await directoryExists(dir)) {
      const pageRoutes = await extractPagesRouterRoutes(
        dir,
        projectRoot,
        exclude,
        localeParamName,
      );
      routes.push(...pageRoutes);
      break; // Only use one pages directory
    }
  }

  return routes;
}

/**
 * Extract routes from Next.js App Router (app/ directory).
 *
 * App Router uses file-system based routing with special file conventions:
 * - page.tsx: Defines a route
 * - layout.tsx: Wraps child routes
 * - route.tsx: API route handler
 * - (group): Route groups (ignored in URL)
 * - [param]: Dynamic segments
 * - [...slug]: Catch-all segments
 * - [[...slug]]: Optional catch-all
 */
async function extractAppRouterRoutes(
  appDir: string,
  projectRoot: string,
  exclude: string[],
  localeParamName: string,
): Promise<ExtractedRoute[]> {
  // Find all page.tsx, page.js, route.tsx, route.js files
  const files = await fg('**/{page,route}.{tsx,ts,jsx,js}', {
    cwd: appDir,
    absolute: true,
    ignore: exclude,
  });

  const routes: ExtractedRoute[] = [];

  for (const file of files) {
    const relativePath = relative(projectRoot, file);

    // Get the directory path relative to app/ (strip the filename)
    const relativeFile = relative(appDir, file);
    const lastSlash = Math.max(
      relativeFile.lastIndexOf('/'),
      relativeFile.lastIndexOf('\\'),
    );
    const routeDir = lastSlash > 0 ? relativeFile.slice(0, lastSlash) : '';

    // Convert directory path to URL segments
    const segments = routeDir
      .split(/[/\\]/)
      .filter((seg) => seg && !isRouteGroup(seg));

    // Skip locale segment if it's the first segment (e.g., [locale] or [lang])
    // This is handled separately by middleware/routing
    const localeSegment = `[${localeParamName}]`;
    const filteredSegments = segments.filter(
      (seg, idx) => !(idx === 0 && seg === localeSegment),
    );

    // Build the canonical path
    const path =
      filteredSegments.length > 0 ? `/${filteredSegments.join('/')}` : '/';

    // Determine route type
    const isRoute = file.includes('route.');
    const type: ExtractedRoute['type'] = isRoute ? 'route' : 'page';

    routes.push({
      path,
      source: relativePath,
      type,
      segments: filteredSegments,
    });
  }

  return deduplicateRoutes(routes);
}

/**
 * Extract routes from Next.js Pages Router (pages/ directory).
 *
 * Pages Router uses file-based routing:
 * - index.tsx: Index route
 * - about.tsx: /about route
 * - blog/[slug].tsx: Dynamic route
 * - [...slug].tsx: Catch-all route
 * - [[...slug]].tsx: Optional catch-all
 */
async function extractPagesRouterRoutes(
  pagesDir: string,
  projectRoot: string,
  exclude: string[],
  localeParamName: string,
): Promise<ExtractedRoute[]> {
  // Find all .tsx, .ts, .jsx, .js files (excluding _app, _document, _error, api)
  const files = await fg('**/*.{tsx,ts,jsx,js}', {
    cwd: pagesDir,
    absolute: true,
    ignore: ['_*', 'api/**', ...exclude],
  });

  const routes: ExtractedRoute[] = [];

  for (const file of files) {
    const relativePath = relative(projectRoot, file);

    // Get the file path relative to pages/ without extension
    const routePath = relative(pagesDir, file)
      .replace(/\.(tsx?|jsx?)$/, '')
      .replace(/([/\\])?index$/, ''); // Remove trailing /index or standalone index

    // Convert to URL segments
    const segments = routePath.split(/[/\\]/).filter(Boolean);

    // Skip locale segment if it's the first segment (e.g., [locale] or [lang])
    const localeSegment = `[${localeParamName}]`;
    const filteredSegments = segments.filter(
      (seg, idx) => !(idx === 0 && seg === localeSegment),
    );

    // Build the canonical path
    const path =
      filteredSegments.length > 0 ? `/${filteredSegments.join('/')}` : '/';

    routes.push({
      path,
      source: relativePath,
      type: 'page',
      segments: filteredSegments,
    });
  }

  return deduplicateRoutes(routes);
}

async function directoryExists(dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Remove duplicate routes (same path from different sources).
 * Keeps the first occurrence.
 */
function deduplicateRoutes(routes: ExtractedRoute[]): ExtractedRoute[] {
  const seen = new Set<string>();
  return routes.filter((route) => {
    if (seen.has(route.path)) {
      return false;
    }
    seen.add(route.path);
    return true;
  });
}
