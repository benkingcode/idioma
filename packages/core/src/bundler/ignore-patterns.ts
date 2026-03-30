import { readFileSync } from 'fs';
import { join } from 'path';
import ignore, { type Ignore } from 'ignore';

/**
 * Minimum patterns that should always be ignored, even if .gitignore doesn't exist.
 * These are universally ignored directories that should never contain translatable code.
 */
const BASE_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  '.generated', // Idiomi generated files - never extract from these
];

/**
 * Normalize a path for the ignore library.
 * The ignore library requires paths without leading './' or '/'.
 */
function normalizePath(filePath: string): string {
  // Strip leading ./
  if (filePath.startsWith('./')) {
    return filePath.slice(2);
  }
  // Strip leading /
  if (filePath.startsWith('/')) {
    return filePath.slice(1);
  }
  return filePath;
}

/**
 * Creates an ignore filter based on the project's .gitignore file.
 *
 * This automatically excludes the same files that git ignores, which typically includes:
 * - node_modules
 * - Build outputs (dist, build, .next, etc.)
 * - Generated files
 * - Platform-specific directories (android, ios, .expo)
 *
 * Falls back to base patterns if .gitignore doesn't exist.
 *
 * @param projectRoot - The project root directory
 * @param additionalPatterns - Optional extra patterns to ignore
 * @returns An Ignore instance that can filter file paths
 */
export function createIgnoreFilter(
  projectRoot: string,
  additionalPatterns?: string[],
): Ignore {
  const ig = ignore();

  // Always add base patterns
  ig.add(BASE_IGNORE_PATTERNS);

  // Try to read .gitignore
  try {
    const gitignorePath = join(projectRoot, '.gitignore');
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  } catch {
    // .gitignore doesn't exist, that's fine
  }

  // Add any user-specified additional patterns
  if (additionalPatterns && additionalPatterns.length > 0) {
    ig.add(additionalPatterns);
  }

  return ig;
}

/**
 * Creates a filter function suitable for chokidar's `ignored` option.
 *
 * @param projectRoot - The project root directory
 * @param additionalPatterns - Optional extra patterns to ignore
 * @returns A function that returns true for paths that should be ignored
 */
export function createChokidarIgnoreFilter(
  projectRoot: string,
  additionalPatterns?: string[],
): (path: string) => boolean {
  const ig = createIgnoreFilter(projectRoot, additionalPatterns);

  return (filePath: string): boolean => {
    let relativePath: string;

    // Convert absolute path to relative for ignore matching
    if (filePath.startsWith(projectRoot)) {
      relativePath = filePath.slice(projectRoot.length + 1);
    } else {
      relativePath = filePath;
    }

    // Normalize and check
    const normalized = normalizePath(relativePath);
    if (!normalized) {
      return false;
    }
    return ig.ignores(normalized);
  };
}

/**
 * Check if a file path should be ignored based on project's .gitignore.
 *
 * @param filePath - Absolute or relative file path
 * @param projectRoot - The project root directory
 * @param additionalPatterns - Optional extra patterns to ignore
 * @returns true if the path should be ignored
 */
export function shouldIgnorePath(
  filePath: string,
  projectRoot: string,
  additionalPatterns?: string[],
): boolean {
  const filter = createChokidarIgnoreFilter(projectRoot, additionalPatterns);
  return filter(filePath);
}
