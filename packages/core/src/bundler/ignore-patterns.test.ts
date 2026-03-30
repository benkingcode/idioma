import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createChokidarIgnoreFilter,
  createIgnoreFilter,
  shouldIgnorePath,
} from './ignore-patterns';

describe('ignore-patterns', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'idiomi-ignore-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createIgnoreFilter', () => {
    it('always ignores node_modules', () => {
      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('node_modules/foo/bar.js')).toBe(true);
    });

    it('always ignores .git', () => {
      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('.git/config')).toBe(true);
    });

    it('reads patterns from .gitignore', () => {
      writeFileSync(join(tempDir, '.gitignore'), 'dist\nbuild\n*.log');

      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('dist/bundle.js')).toBe(true);
      expect(ig.ignores('build/output.js')).toBe(true);
      expect(ig.ignores('error.log')).toBe(true);
      expect(ig.ignores('src/App.tsx')).toBe(false);
    });

    it('works without .gitignore', () => {
      // No .gitignore created
      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('node_modules/foo.js')).toBe(true);
      expect(ig.ignores('src/App.tsx')).toBe(false);
    });

    it('adds additional patterns', () => {
      const ig = createIgnoreFilter(tempDir, ['*.test.ts', 'fixtures']);

      expect(ig.ignores('App.test.ts')).toBe(true);
      expect(ig.ignores('fixtures/data.json')).toBe(true);
      expect(ig.ignores('App.tsx')).toBe(false);
    });

    it('combines gitignore and additional patterns', () => {
      writeFileSync(join(tempDir, '.gitignore'), 'dist\n');

      const ig = createIgnoreFilter(tempDir, ['*.test.ts']);

      expect(ig.ignores('dist/bundle.js')).toBe(true);
      expect(ig.ignores('App.test.ts')).toBe(true);
      expect(ig.ignores('App.tsx')).toBe(false);
    });
  });

  describe('createChokidarIgnoreFilter', () => {
    it('works with absolute paths', () => {
      writeFileSync(join(tempDir, '.gitignore'), 'dist\n');

      const filter = createChokidarIgnoreFilter(tempDir);

      expect(filter(join(tempDir, 'dist', 'bundle.js'))).toBe(true);
      expect(filter(join(tempDir, 'src', 'App.tsx'))).toBe(false);
    });

    it('works with relative paths', () => {
      writeFileSync(join(tempDir, '.gitignore'), 'dist\n');

      const filter = createChokidarIgnoreFilter(tempDir);

      expect(filter('dist/bundle.js')).toBe(true);
      expect(filter('src/App.tsx')).toBe(false);
    });
  });

  describe('shouldIgnorePath', () => {
    it('returns true for ignored paths', () => {
      writeFileSync(join(tempDir, '.gitignore'), 'dist\n');

      expect(shouldIgnorePath('dist/bundle.js', tempDir)).toBe(true);
    });

    it('returns false for non-ignored paths', () => {
      expect(shouldIgnorePath('src/App.tsx', tempDir)).toBe(false);
    });

    it('supports additional patterns', () => {
      expect(shouldIgnorePath('App.test.ts', tempDir, ['*.test.ts'])).toBe(
        true,
      );
    });
  });

  describe('common gitignore patterns', () => {
    it('handles Expo project gitignore', () => {
      writeFileSync(
        join(tempDir, '.gitignore'),
        `
node_modules/
.expo/
dist/
android/
ios/
*.log
`,
      );

      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('.expo/cache/foo.js')).toBe(true);
      expect(ig.ignores('android/app/build.gradle')).toBe(true);
      expect(ig.ignores('ios/Pods/Something.m')).toBe(true);
      expect(ig.ignores('src/App.tsx')).toBe(false);
    });

    it('handles Next.js project gitignore', () => {
      writeFileSync(
        join(tempDir, '.gitignore'),
        `
node_modules
.next
out
.vercel
`,
      );

      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('.next/static/chunks/main.js')).toBe(true);
      expect(ig.ignores('out/index.html')).toBe(true);
      expect(ig.ignores('pages/index.tsx')).toBe(false);
    });

    it('handles comment lines and empty lines', () => {
      writeFileSync(
        join(tempDir, '.gitignore'),
        `
# This is a comment
dist/

# Another comment
build/
`,
      );

      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('dist/bundle.js')).toBe(true);
      expect(ig.ignores('build/output.js')).toBe(true);
      expect(ig.ignores('src/App.tsx')).toBe(false);
    });

    it('handles negation patterns for files', () => {
      writeFileSync(
        join(tempDir, '.gitignore'),
        `
*.log
!important.log
`,
      );

      const ig = createIgnoreFilter(tempDir);
      expect(ig.ignores('debug.log')).toBe(true);
      expect(ig.ignores('error.log')).toBe(true);
      expect(ig.ignores('important.log')).toBe(false); // Negation works for files
    });
  });
});
