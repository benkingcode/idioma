import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureGitignore, GITIGNORE_CONTENT } from './gitignore';

describe('ensureGitignore', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Use OS temp directory to avoid writing inside project root
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idiomi-gitignore-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('creates .gitignore and locales/ when missing', async () => {
    await ensureGitignore(tempDir);

    const content = await fs.readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toBe(GITIGNORE_CONTENT);

    // Verify locales/ directory was created
    const localesStat = await fs.stat(join(tempDir, 'locales'));
    expect(localesStat.isDirectory()).toBe(true);
  });

  it('creates parent directories if they do not exist', async () => {
    const nestedDir = join(tempDir, 'nested', 'idiomi');

    await ensureGitignore(nestedDir);

    const content = await fs.readFile(join(nestedDir, '.gitignore'), 'utf-8');
    expect(content).toBe(GITIGNORE_CONTENT);
  });

  it('does nothing when .gitignore already has correct content', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, GITIGNORE_CONTENT);
    const statBefore = await fs.stat(gitignorePath);

    // Small delay to ensure mtime would change if file was written
    await new Promise((resolve) => setTimeout(resolve, 10));

    await ensureGitignore(tempDir);

    const statAfter = await fs.stat(gitignorePath);
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
  });

  it('updates .gitignore when content differs', async () => {
    const gitignorePath = join(tempDir, '.gitignore');
    await fs.writeFile(gitignorePath, '# Old content\nnode_modules/\n');

    await ensureGitignore(tempDir);

    const content = await fs.readFile(gitignorePath, 'utf-8');
    expect(content).toBe(GITIGNORE_CONTENT);
  });

  it('has the expected gitignore content', () => {
    // Verify the content ignores .generated/ only
    expect(GITIGNORE_CONTENT).toContain('.generated/');
    expect(GITIGNORE_CONTENT).toContain('# Idiomi generated files');
  });

  it('skips creating locales/ when skipLocalesDir is true', async () => {
    await ensureGitignore(tempDir, { skipLocalesDir: true });

    // .gitignore should still be created
    const content = await fs.readFile(join(tempDir, '.gitignore'), 'utf-8');
    expect(content).toBe(GITIGNORE_CONTENT);

    // But locales/ should NOT be created
    const localesExists = await fs
      .stat(join(tempDir, 'locales'))
      .then(() => true)
      .catch(() => false);
    expect(localesExists).toBe(false);
  });
});
