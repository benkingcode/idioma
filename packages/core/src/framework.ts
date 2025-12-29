import { existsSync, promises as fs } from 'fs';
import { join } from 'path';

/**
 * Detected framework type for routing integration.
 * - 'next-app': Next.js with App Router (has app/ directory)
 * - 'next-pages': Next.js with Pages Router (has pages/ but no app/)
 * - 'tanstack': TanStack Router
 * - null: No framework detected
 */
export type Framework = 'next-app' | 'next-pages' | 'tanstack' | null;

/**
 * Detect the framework being used based on package.json dependencies
 * and directory structure.
 */
export async function detectFramework(cwd: string): Promise<Framework> {
  try {
    const pkgPath = join(cwd, 'package.json');
    const content = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Check for TanStack Router first (more specific)
    if (allDeps['@tanstack/react-router'] || allDeps['@tanstack/router']) {
      return 'tanstack';
    }

    // Check for Next.js
    if (allDeps['next']) {
      // Determine App Router vs Pages Router based on directory structure
      const hasAppDir =
        existsSync(join(cwd, 'app')) || existsSync(join(cwd, 'src', 'app'));
      const hasPagesDir =
        existsSync(join(cwd, 'pages')) || existsSync(join(cwd, 'src', 'pages'));

      // App Router takes precedence if both exist (hybrid setup)
      if (hasAppDir) {
        return 'next-app';
      }
      if (hasPagesDir) {
        return 'next-pages';
      }
      // Default to App Router for Next.js 13+
      return 'next-app';
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get the package import path for the detected framework's Link component.
 */
export function getLinkPackage(framework: Framework): string | null {
  switch (framework) {
    case 'next-app':
      return '@idiomi/next';
    case 'next-pages':
      return '@idiomi/next/pages';
    case 'tanstack':
      return '@idiomi/tanstack-react';
    default:
      return null;
  }
}
