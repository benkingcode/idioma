import { readdirSync, readFileSync, statSync } from 'fs';
import { builtinModules } from 'module';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseSync, type Program } from 'oxc-parser';
import { describe, expect, it } from 'vitest';

/**
 * What the published packages import must be installed with them. The CLI
 * imported dotenv, a devDependency, so `idioma` crashed on a clean install
 * ("Cannot find package 'dotenv'") and only worked inside this repo.
 */

const PACKAGES_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../..',
);
const BUILTINS = new Set(builtinModules);

interface ImportRef {
  source: string;
  /** import(...) rather than a static import */
  dynamic: boolean;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (
      /\.tsx?$/.test(name) &&
      !/\.test\.tsx?$|\.types\.tsx?$/.test(name)
    ) {
      out.push(path);
    }
  }
  return out;
}

/**
 * The imports of a module. By default only runtime ones: type-only imports
 * are erased. With `types`, type-only imports too, as a published .d.ts
 * keeps them.
 */
function runtimeImports(
  file: string,
  { types = false }: { types?: boolean } = {},
): ImportRef[] {
  const program = parseSync(file, readFileSync(file, 'utf8'))
    .program as Program;
  const refs: ImportRef[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    const n = node as Record<string, any>;
    if (n.type === 'ImportDeclaration' && (types || n.importKind !== 'type')) {
      const specifiers = n.specifiers as Array<Record<string, any>>;
      const allTypes =
        specifiers.length > 0 &&
        specifiers.every(
          (s) => s.type === 'ImportSpecifier' && s.importKind === 'type',
        );
      if (types || !allTypes) {
        refs.push({ source: n.source.value, dynamic: false });
      }
    } else if (
      (n.type === 'ExportNamedDeclaration' ||
        n.type === 'ExportAllDeclaration') &&
      n.source &&
      (types || n.exportKind !== 'type')
    ) {
      refs.push({ source: n.source.value, dynamic: false });
    } else if (n.type === 'ImportExpression' && n.source?.type === 'Literal') {
      refs.push({ source: n.source.value, dynamic: true });
    }
    for (const value of Object.values(n)) visit(value);
  };
  visit(program);
  return refs;
}

function packageName(source: string): string {
  const parts = source.split('/');
  return source.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]!;
}

function isBare(source: string): boolean {
  return (
    !source.startsWith('.') &&
    !source.startsWith('node:') &&
    !BUILTINS.has(source)
  );
}

describe('published package dependencies', () => {
  for (const pkg of ['core', 'react', 'ai']) {
    it(`@idioma/${pkg} declares every package its source imports`, () => {
      const root = join(PACKAGES_DIR, pkg);
      const manifest = JSON.parse(
        readFileSync(join(root, 'package.json'), 'utf8'),
      );
      const declared = new Set([
        manifest.name,
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
      ]);
      const missing = new Set<string>();
      for (const file of sourceFiles(join(root, 'src'))) {
        for (const { source } of runtimeImports(file)) {
          if (isBare(source) && !declared.has(packageName(source))) {
            missing.add(
              `${packageName(source)} (${file.slice(root.length + 1)})`,
            );
          }
        }
      }
      expect([...missing]).toEqual([]);
    });
  }

  it('core and react never name the AI SDK, not even in their types', () => {
    // AI translation is @idioma/ai's job. A type-only import from 'ai' in
    // core used to survive into its .d.ts, so a project with
    // skipLibCheck: false and no AI SDK failed to typecheck
    const offenders: string[] = [];
    for (const pkg of ['core', 'react']) {
      const root = join(PACKAGES_DIR, pkg);
      for (const file of sourceFiles(join(root, 'src'))) {
        for (const { source } of runtimeImports(file, { types: true })) {
          const name = packageName(source);
          if (
            name === 'ai' ||
            name.startsWith('@ai-sdk/') ||
            name === '@idioma/ai'
          ) {
            offenders.push(`${source} (${pkg}/${file.slice(root.length + 1)})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
