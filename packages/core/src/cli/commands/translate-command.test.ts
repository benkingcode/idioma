import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_INSTALL_HINT,
  loadAiPackage,
  runTranslateCli,
  type TranslateCommandArgs,
} from './translate-command';

/**
 * idioma translate lives in @idioma/ai. Core's CLI finds it in the user's
 * project: pnpm links only a package's own dependencies next to it, so a
 * bare import('@idioma/ai') from core would miss the project's copy.
 */

const ARGS = { locale: 'es', verbose: false } as TranslateCommandArgs;
const dirs: string[] = [];

/** A project folder, optionally with a fake @idioma/ai installed. */
function project(aiEntry?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'idioma-translate-'));
  dirs.push(root);
  writeFileSync(join(root, 'package.json'), '{"name":"app","type":"module"}');
  if (aiEntry !== undefined) {
    const pkg = join(root, 'node_modules', '@idioma', 'ai');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({
        name: '@idioma/ai',
        type: 'module',
        exports: { '.': { import: './index.mjs', require: './index.mjs' } },
      }),
    );
    writeFileSync(join(pkg, 'index.mjs'), aiEntry);
  }
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = undefined;
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

describe('loadAiPackage', () => {
  it("loads @idioma/ai from the project's node_modules", async () => {
    const root = project(
      'export async function runTranslateCommand(args) { globalThis.__idiomaAiArgs = args; }',
    );
    const ai = await loadAiPackage(root);
    expect(ai).toBeDefined();
    await ai!.runTranslateCommand(ARGS);
    expect((globalThis as Record<string, unknown>).__idiomaAiArgs).toBe(ARGS);
  });

  it('is undefined when the project has no @idioma/ai', async () => {
    expect(await loadAiPackage(project())).toBeUndefined();
  });

  it('is undefined when @idioma/ai is there but the AI SDK is not', async () => {
    // @idioma/ai imports `ai`, a peer the project has to install
    const root = project(
      "import 'ai';\nexport async function runTranslateCommand() {}",
    );
    expect(await loadAiPackage(root)).toBeUndefined();
  });

  it('rethrows any other error from @idioma/ai', async () => {
    const root = project("throw new Error('broken build');");
    await expect(loadAiPackage(root)).rejects.toThrow('broken build');
  });
});

describe('runTranslateCli', () => {
  it('runs @idioma/ai with the parsed arguments', async () => {
    const root = project(
      'export async function runTranslateCommand(args) { globalThis.__idiomaAiRan = args; }',
    );
    await runTranslateCli(ARGS, root);
    expect((globalThis as Record<string, unknown>).__idiomaAiRan).toBe(ARGS);
    expect(process.exitCode).toBeUndefined();
  });

  it('says what to install, and exits 1, without @idioma/ai', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runTranslateCli(ARGS, project());
    expect(error).toHaveBeenCalledWith(AI_INSTALL_HINT);
    expect(AI_INSTALL_HINT).toContain(
      'pnpm add -D @idioma/ai ai@6 @ai-sdk/anthropic@3',
    );
    expect(process.exitCode).toBe(1);
  });
});
