import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeIfChanged } from './write-if-changed';

describe('writeIfChanged', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'idioma-write-if-changed-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('writes the file when it does not exist and returns true', async () => {
    const filePath = join(tempDir, 'new.txt');

    const wrote = await writeIfChanged(filePath, 'hello');

    expect(wrote).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('hello');
  });

  it('writes the file when content differs and returns true', async () => {
    const filePath = join(tempDir, 'existing.txt');
    await fs.writeFile(filePath, 'old', 'utf-8');

    const wrote = await writeIfChanged(filePath, 'new');

    expect(wrote).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('new');
  });

  it('skips the write and leaves mtime untouched when content is identical', async () => {
    const filePath = join(tempDir, 'unchanged.txt');
    await fs.writeFile(filePath, 'same', 'utf-8');
    const before = await fs.stat(filePath);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const wrote = await writeIfChanged(filePath, 'same');
    const after = await fs.stat(filePath);

    expect(wrote).toBe(false);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it('returns false consistently for repeated identical writes', async () => {
    const filePath = join(tempDir, 'idempotent.txt');

    expect(await writeIfChanged(filePath, 'x')).toBe(true);
    expect(await writeIfChanged(filePath, 'x')).toBe(false);
    expect(await writeIfChanged(filePath, 'x')).toBe(false);
  });

  it('skips the write when existing content differs only by trailing whitespace', async () => {
    // Simulates a formatter (Prettier, EditorConfig) appending a final newline
    // to a generated file. We should treat it as unchanged.
    const filePath = join(tempDir, 'formatted.ts');
    await fs.writeFile(filePath, 'export const x = 1;\n\n', 'utf-8');
    const before = await fs.stat(filePath);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const wrote = await writeIfChanged(filePath, 'export const x = 1;\n');
    const after = await fs.stat(filePath);

    expect(wrote).toBe(false);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it('still writes when content differs in non-whitespace ways', async () => {
    const filePath = join(tempDir, 'substantive.ts');
    await fs.writeFile(filePath, 'export const x = 1;\n', 'utf-8');

    const wrote = await writeIfChanged(filePath, 'export const x = 2;\n');

    expect(wrote).toBe(true);
    expect(await fs.readFile(filePath, 'utf-8')).toBe('export const x = 2;\n');
  });
});
