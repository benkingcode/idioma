import { promises as fs } from 'fs';
import { join } from 'path';

export const GITIGNORE_CONTENT = `# Idiomi generated files - do not edit
.generated/
`;

export interface EnsureGitignoreOptions {
  /**
   * Skip creating the locales/ subdirectory.
   * Set to true when using a custom localesDir.
   */
  skipLocalesDir?: boolean;
}

/**
 * Ensure the idiomi directory structure is set up correctly:
 * - Creates the idiomi directory
 * - Creates the locales/ subdirectory (unless skipLocalesDir is true)
 * - Creates/updates .gitignore
 */
export async function ensureGitignore(
  idiomiDir: string,
  options?: EnsureGitignoreOptions,
): Promise<void> {
  // Ensure idiomi directory exists
  await fs.mkdir(idiomiDir, { recursive: true });

  // Create locales/ subdirectory unless using custom localesDir
  if (!options?.skipLocalesDir) {
    await fs.mkdir(join(idiomiDir, 'locales'), { recursive: true });
  }

  // Ensure .gitignore exists and is up to date
  const gitignorePath = join(idiomiDir, '.gitignore');

  try {
    const existing = await fs.readFile(gitignorePath, 'utf-8');
    if (existing === GITIGNORE_CONTENT) {
      return; // Already up to date
    }
  } catch {
    // File doesn't exist, will create
  }

  await fs.writeFile(gitignorePath, GITIGNORE_CONTENT, 'utf-8');
}
