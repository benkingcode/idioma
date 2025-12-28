import { promises as fs } from 'fs';
import { join, relative } from 'path';
import fg from 'fast-glob';
import type { ExtractedRoute, ExtractRoutesOptions } from './types.js';

/**
 * Extract routes from a TanStack Router project.
 *
 * TanStack Router uses file-based routing similar to Next.js App Router,
 * but with different conventions:
 * - routes/ directory contains route files
 * - $param for dynamic segments (vs [param] in Next.js)
 * - _.tsx for pathless layouts
 * - _layout.tsx for layouts
 *
 * We also parse createFileRoute('/path') calls as fallback.
 */
export async function extractTanStackRoutes(
  options: ExtractRoutesOptions,
): Promise<ExtractedRoute[]> {
  const { projectRoot, exclude = [] } = options;

  // Common TanStack Router routes locations
  const routesDirs = [
    join(projectRoot, 'src', 'routes'),
    join(projectRoot, 'app', 'routes'),
    join(projectRoot, 'routes'),
  ];

  for (const routesDir of routesDirs) {
    if (await directoryExists(routesDir)) {
      return extractFromRoutesDir(routesDir, projectRoot, exclude);
    }
  }

  // Fallback: scan for createFileRoute calls in source files
  return extractFromSourceFiles(projectRoot, exclude);
}

/**
 * Extract routes from TanStack Router's file-based routing.
 *
 * File naming conventions:
 * - index.tsx → /
 * - about.tsx → /about
 * - blog.$slug.tsx → /blog/$slug
 * - blog_.tsx → pathless layout for blog routes
 * - _layout.tsx → layout wrapper
 */
async function extractFromRoutesDir(
  routesDir: string,
  projectRoot: string,
  exclude: string[],
): Promise<ExtractedRoute[]> {
  const files = await fg('**/*.{tsx,ts,jsx,js}', {
    cwd: routesDir,
    absolute: true,
    ignore: exclude,
  });

  const routes: ExtractedRoute[] = [];

  for (const file of files) {
    const relativePath = relative(projectRoot, file);

    // Get file name without extension
    const fileName = file
      .split(/[/\\]/)
      .pop()!
      .replace(/\.(tsx?|jsx?)$/, '');

    // Skip layout files and root route
    if (
      fileName.startsWith('_') ||
      fileName === '__root' ||
      fileName.endsWith('_')
    ) {
      continue;
    }

    // Get the directory path relative to routes/
    const routeFile = relative(routesDir, file).replace(/\.(tsx?|jsx?)$/, '');

    // Parse the route path from file name
    // TanStack uses dots to separate path segments in file names
    const path = parseRouteFileName(routeFile);
    const segments = pathToSegments(path);

    // Filter out $lang segment if first
    const filteredSegments = segments.filter(
      (seg, idx) => !(idx === 0 && seg === '$lang'),
    );

    // Normalize $param to [param] for consistency
    const normalizedSegments = filteredSegments.map((seg) =>
      seg.startsWith('$') ? `[${seg.slice(1)}]` : seg,
    );

    const normalizedPath =
      normalizedSegments.length > 0 ? `/${normalizedSegments.join('/')}` : '/';

    routes.push({
      path: normalizedPath,
      source: relativePath,
      type: 'page',
      segments: normalizedSegments,
    });
  }

  return deduplicateRoutes(routes);
}

/**
 * Parse TanStack Router file name to route path.
 *
 * Examples:
 * - index → /
 * - about → /about
 * - blog.$slug → /blog/$slug
 * - blog.index → /blog
 * - (group).about → /about (group ignored)
 */
function parseRouteFileName(fileName: string): string {
  // Split by dot or directory separator
  const parts = fileName.split(/[./\\]/);

  // Filter out index, empty, and group segments
  const segments = parts.filter((part) => {
    if (!part || part === 'index') return false;
    if (part.startsWith('(') && part.endsWith(')')) return false;
    return true;
  });

  return segments.length > 0 ? `/${segments.join('/')}` : '/';
}

function pathToSegments(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/**
 * Fallback: Extract routes by parsing createFileRoute() calls in source code.
 */
async function extractFromSourceFiles(
  projectRoot: string,
  exclude: string[],
): Promise<ExtractedRoute[]> {
  const files = await fg('src/**/*.{tsx,ts,jsx,js}', {
    cwd: projectRoot,
    absolute: true,
    ignore: exclude,
  });

  const routes: ExtractedRoute[] = [];
  const routeRegex = /createFileRoute\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

  for (const file of files) {
    const relativePath = relative(projectRoot, file);

    try {
      const content = await fs.readFile(file, 'utf-8');
      let match;

      while ((match = routeRegex.exec(content)) !== null) {
        const routePath = match[1];
        if (!routePath) continue;

        // Normalize $param to [param]
        const normalizedPath = routePath.replace(/\$([^/]+)/g, '[$1]');
        const segments = pathToSegments(normalizedPath);

        // Filter out [lang] if first
        const filteredSegments = segments.filter(
          (seg, idx) => !(idx === 0 && seg === '[lang]'),
        );

        routes.push({
          path:
            filteredSegments.length > 0
              ? `/${filteredSegments.join('/')}`
              : '/',
          source: relativePath,
          type: 'page',
          segments: filteredSegments,
        });
      }
    } catch {
      // Skip files that can't be read
    }
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
