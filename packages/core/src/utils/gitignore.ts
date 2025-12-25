import { promises as fs } from 'fs';
import { join } from 'path';

export const GITIGNORE_CONTENT = `# Idioma generated files - do not edit
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
 * Ensure the idioma directory structure is set up correctly:
 * - Creates the idioma directory
 * - Creates the locales/ subdirectory (unless skipLocalesDir is true)
 * - Creates/updates .gitignore
 */
export async function ensureGitignore(
  idiomaDir: string,
  options?: EnsureGitignoreOptions,
): Promise<void> {
  // Ensure idioma directory exists
  await fs.mkdir(idiomaDir, { recursive: true });

  // Create locales/ subdirectory unless using custom localesDir
  if (!options?.skipLocalesDir) {
    await fs.mkdir(join(idiomaDir, 'locales'), { recursive: true });
  }

  // Ensure .gitignore exists and is up to date
  const gitignorePath = join(idiomaDir, '.gitignore');

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
