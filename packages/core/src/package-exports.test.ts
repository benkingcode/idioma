import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

interface ExportConditions {
  import?: string;
  require?: string;
}

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { exports: Record<string, ExportConditions> };

describe('package exports', () => {
  // metro.config.js is CommonJS, so React Native apps load the Metro plugin
  // with require(). With only an `import` condition, that fails with
  // ERR_PACKAGE_PATH_NOT_EXPORTED. Node 20.19+ can require() the ES module,
  // so `require` points at the same file.
  it.each(Object.entries(pkg.exports))(
    '%s can be loaded with require() as well as import',
    (_subpath, conditions) => {
      expect(conditions.require).toBe(conditions.import);
    },
  );
});
