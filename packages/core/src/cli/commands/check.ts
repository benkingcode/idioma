import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { defineCommand } from 'citty';
import { loadPoFile } from '../../po/parser';
import { loadConfig } from '../config';

export interface MissingTranslation {
  locale: string;
  key: string;
  source: string;
}

export interface LocaleStats {
  total: number;
  translated: number;
  missing: number;
  fuzzy: number;
}

export interface CheckResult {
  complete: boolean;
  missing: MissingTranslation[];
  fuzzy: MissingTranslation[];
  stats: Record<string, LocaleStats>;
}

export interface CheckOptions {
  localeDir: string;
  locale?: string;
}

/**
 * Check translation completeness.
 */
export async function runCheck(options: CheckOptions): Promise<CheckResult> {
  const { localeDir, locale } = options;

  const files = await fs.readdir(localeDir);
  let poFiles = files.filter((f) => f.endsWith('.po'));

  // Filter to specific locale if provided
  if (locale) {
    poFiles = poFiles.filter((f) => f === `${locale}.po`);
  }

  const missing: MissingTranslation[] = [];
  const fuzzy: MissingTranslation[] = [];
  const stats: Record<string, LocaleStats> = {};

  for (const file of poFiles) {
    const localeCode = basename(file, '.po');
    const catalog = await loadPoFile(join(localeDir, file), localeCode);

    let translated = 0;
    let missingCount = 0;
    let fuzzyCount = 0;
    const total = catalog.messages.size;

    for (const [key, message] of catalog.messages) {
      const isFuzzy = message.flags?.includes('fuzzy') ?? false;
      const isTranslated =
        message.translation && message.translation.length > 0;

      if (isFuzzy) {
        fuzzyCount++;
        fuzzy.push({
          locale: localeCode,
          key,
          source: message.source,
        });
      } else if (!isTranslated) {
        missingCount++;
        missing.push({
          locale: localeCode,
          key,
          source: message.source,
        });
      } else {
        translated++;
      }
    }

    stats[localeCode] = {
      total,
      translated,
      missing: missingCount,
      fuzzy: fuzzyCount,
    };
  }

  return {
    complete: missing.length === 0 && fuzzy.length === 0,
    missing,
    fuzzy,
    stats,
  };
}

export const checkCommand = defineCommand({
  meta: {
    name: 'check',
    description: 'Check translation completeness',
  },
  args: {
    locale: {
      type: 'string',
      description: 'Check only this locale',
    },
  },
  async run({ args }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);

    const result = await runCheck({
      localeDir: config.localeDir,
      locale: args.locale,
    });

    // Print stats
    for (const [locale, localeStats] of Object.entries(result.stats)) {
      const percent = Math.round(
        (localeStats.translated / localeStats.total) * 100,
      );
      console.log(
        `${locale}: ${localeStats.translated}/${localeStats.total} (${percent}%) translated`,
      );

      if (localeStats.missing > 0) {
        console.log(`  ${localeStats.missing} missing`);
      }
      if (localeStats.fuzzy > 0) {
        console.log(`  ${localeStats.fuzzy} fuzzy`);
      }
    }

    if (!result.complete) {
      console.log('\nTranslations are incomplete!');
      process.exitCode = 1;
    } else {
      console.log('\nAll translations complete!');
    }
  },
});
