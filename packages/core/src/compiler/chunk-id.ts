import { createHash } from 'crypto';
import path from 'path';

/**
 * Generate a unique, deterministic chunk ID from a file path.
 *
 * The ID consists of:
 * - A human-readable prefix (filename or parent directory for index files)
 * - An 8-character hash suffix for uniqueness
 *
 * @example
 * getChunkId('/project/src/pages/HomePage.tsx', '/project')
 * // => "HomePage_x7Fk29Ab"
 *
 * getChunkId('/project/src/pages/Home/index.tsx', '/project')
 * // => "Home_k2Wn47Cd"
 */
export function getChunkId(filePath: string, projectRoot: string): string {
  // Normalize to relative path from project root
  const relativePath = path.relative(projectRoot, filePath);

  // Generate short hash - 8 chars is enough for uniqueness within a project
  const hash = createHash('sha256')
    .update(relativePath)
    .digest('base64url')
    .slice(0, 8);

  // Human-readable prefix
  const basename = path.basename(filePath, path.extname(filePath));
  const name =
    basename === 'index' ? path.basename(path.dirname(filePath)) : basename;

  return `${name}_${hash}`;
}
