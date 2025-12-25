import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { defineCommand } from 'citty';
import { loadPoFile } from '../../po/parser';
import { getIdiomaPaths, loadConfig } from '../config';

export interface LocaleStats {
  locale: string;
  total: number;
  translated: number;
  missing: number;
  fuzzy: number;
  percentage: number;
}

export interface StatsResult {
  locales: LocaleStats[];
  totalMessages: number;
  overallPercentage: number;
}

export interface StatsOptions {
  localeDir: string;
}

/**
 * Get translation statistics.
 */
export async function runStats(options: StatsOptions): Promise<StatsResult> {
  const { localeDir } = options;

  const files = await fs.readdir(localeDir);
  const poFiles = files.filter((f) => f.endsWith('.po'));

  const locales: LocaleStats[] = [];
  let totalMessages = 0;
  let totalTranslated = 0;

  for (const file of poFiles) {
    const localeCode = basename(file, '.po');
    const catalog = await loadPoFile(join(localeDir, file), localeCode);

    let translated = 0;
    let missing = 0;
    let fuzzy = 0;
    const total = catalog.messages.size;

    // Track total messages (use the first locale as reference)
    if (totalMessages === 0) {
      totalMessages = total;
    }

    for (const [, message] of catalog.messages) {
      const isFuzzy = message.flags?.includes('fuzzy') ?? false;
      const isTranslated =
        message.translation && message.translation.length > 0;

      if (isFuzzy) {
        fuzzy++;
      } else if (isTranslated) {
        translated++;
      } else {
        missing++;
      }
    }

    totalTranslated += translated;

    const percentage = total > 0 ? Math.round((translated / total) * 100) : 0;

    locales.push({
      locale: localeCode,
      total,
      translated,
      missing,
      fuzzy,
      percentage,
    });
  }

  const overallPercentage =
    locales.length > 0 && totalMessages > 0
      ? Math.round((totalTranslated / (totalMessages * locales.length)) * 100)
      : 0;

  return {
    locales,
    totalMessages,
    overallPercentage,
  };
}

export const statsCommand = defineCommand({
  meta: {
    name: 'stats',
    description: 'Show translation statistics',
  },
  args: {},
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const { localeDir } = getIdiomaPaths(config);

    const result = await runStats({
      localeDir,
    });

    console.log(`Translation Statistics`);
    console.log(`======================`);
    console.log(`Total messages: ${result.totalMessages}`);
    console.log(`Overall completion: ${result.overallPercentage}%`);
    console.log('');

    for (const locale of result.locales) {
      console.log(`${locale.locale}:`);
      console.log(
        `  Translated: ${locale.translated}/${locale.total} (${locale.percentage}%)`,
      );
      if (locale.missing > 0) {
        console.log(`  Missing: ${locale.missing}`);
      }
      if (locale.fuzzy > 0) {
        console.log(`  Fuzzy: ${locale.fuzzy}`);
      }
    }
  },
});
