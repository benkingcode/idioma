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
