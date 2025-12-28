import type { Framework } from '../framework.js';
import { extractNextjsRoutes } from './extract-nextjs.js';
import { extractTanStackRoutes } from './extract-tanstack.js';
import type { ExtractedRoute } from './types.js';

/**
 * Route extraction and compilation for localized pathnames.
 *
 * This module provides utilities to:
 * 1. Extract routes from Next.js or TanStack Router projects
 * 2. Generate route segments for PO file translation
 * 3. Compile translated segments back to route maps
 *
 * Routes are only extracted when `routing.localizedPaths: true` in config.
 */

export * from './types.js';
export * from './extract-nextjs.js';
export * from './extract-tanstack.js';
export {
  compileRoutes,
  generateRoutesModule,
  generateRoutesTypes,
  ROUTE_CONTEXT_PREFIX,
} from './compile.js';

/**
 * Extract routes from a project based on the detected framework.
 *
 * @param projectRoot - Root directory of the project
 * @param framework - The detected framework type
 * @returns Extracted routes for the project
 */
export async function extractRoutes(
  projectRoot: string,
  framework: Framework,
): Promise<ExtractedRoute[]> {
  const options = { projectRoot };
  switch (framework) {
    case 'next-app':
    case 'next-pages':
      return extractNextjsRoutes(options);
    case 'tanstack':
      return extractTanStackRoutes(options);
    default:
      return [];
  }
}
