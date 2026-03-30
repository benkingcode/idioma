import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isAliasedIdiomaImport,
  loadPathsMatcher,
} from './resolve-tsconfig-paths';

describe('resolve-tsconfig-paths', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'idioma-tsconfig-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('loadPathsMatcher', () => {
    it('returns null when no tsconfig.json exists', () => {
      const matcher = loadPathsMatcher(tempDir);
      expect(matcher).toBeNull();
    });

    it('returns null when tsconfig has no paths', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            strict: true,
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir);
      expect(matcher).toBeNull();
    });

    it('returns a matcher when tsconfig has paths', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@app/*': ['./src/*'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir);
      expect(matcher).toBeTypeOf('function');
    });

    it('handles tsconfig with extends', () => {
      // Base config defines paths
      writeFileSync(
        join(tempDir, 'tsconfig.base.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@app/*': ['./src/*'],
            },
          },
        }),
      );

      // Leaf config extends base
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          extends: './tsconfig.base.json',
        }),
      );

      const matcher = loadPathsMatcher(tempDir);
      expect(matcher).toBeTypeOf('function');
    });
  });

  describe('isAliasedIdiomaImport', () => {
    it('returns true when alias resolves to idiomaDir', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@dancefloor-start/*': ['./src/*'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir)!;
      const idiomaDir = join(tempDir, 'src', 'idioma');

      expect(
        isAliasedIdiomaImport('@dancefloor-start/idioma', idiomaDir, matcher),
      ).toBe(true);
    });

    it('returns true for subpath imports within idiomaDir', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@app/*': ['./src/*'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir)!;
      const idiomaDir = join(tempDir, 'src', 'idioma');

      // @app/idioma/plain should also match
      expect(
        isAliasedIdiomaImport('@app/idioma/plain', idiomaDir, matcher),
      ).toBe(true);
    });

    it('returns false when alias resolves outside idiomaDir', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@utils/*': ['./src/utils/*'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir)!;
      const idiomaDir = join(tempDir, 'src', 'idioma');

      expect(isAliasedIdiomaImport('@utils/helpers', idiomaDir, matcher)).toBe(
        false,
      );
    });

    it('returns false when import does not match any alias', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@app/*': ['./src/*'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir)!;
      const idiomaDir = join(tempDir, 'src', 'idioma');

      expect(
        isAliasedIdiomaImport('some-random-package', idiomaDir, matcher),
      ).toBe(false);
    });

    it('handles exact path aliases (no wildcard)', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@idioma': ['./src/idioma'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir)!;
      const idiomaDir = join(tempDir, 'src', 'idioma');

      expect(isAliasedIdiomaImport('@idioma', idiomaDir, matcher)).toBe(true);
    });

    it('handles common @/ alias pattern', () => {
      writeFileSync(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            paths: {
              '@/*': ['./src/*'],
            },
          },
        }),
      );

      const matcher = loadPathsMatcher(tempDir)!;
      const idiomaDir = join(tempDir, 'src', 'idioma');

      expect(isAliasedIdiomaImport('@/idioma', idiomaDir, matcher)).toBe(true);

      expect(
        isAliasedIdiomaImport('@/components/Header', idiomaDir, matcher),
      ).toBe(false);
    });
  });
});
