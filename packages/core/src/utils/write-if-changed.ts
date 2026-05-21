import { promises as fs } from 'fs';

/**
 * Write content to a file only if it differs from what's already on disk.
 * Returns true if the file was written, false if it was left untouched.
 *
 * Useful for build outputs whose timestamps drive file watchers — skipping
 * unchanged writes prevents downstream tools from reacting to no-op rebuilds.
 */
export async function writeIfChanged(
  filePath: string,
  content: string,
): Promise<boolean> {
  try {
    const existing = await fs.readFile(filePath, 'utf-8');
    if (existing === content) return false;
  } catch {
    // File doesn't exist (or isn't readable) — fall through to write
  }
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
}
