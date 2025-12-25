import { promises as fs } from 'fs';
import { join } from 'path';

export const GITIGNORE_CONTENT = `# Idioma generated files - do not edit
.generated/
`;

/**
 * Ensure the idioma directory structure is set up correctly:
 * - Creates the idioma directory
 * - Creates the locales/ subdirectory
 * - Creates/updates .gitignore
 */
export async function ensureGitignore(idiomaDir: string): Promise<void> {
  // Ensure directories exist
  await fs.mkdir(idiomaDir, { recursive: true });
  await fs.mkdir(join(idiomaDir, 'locales'), { recursive: true });

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
