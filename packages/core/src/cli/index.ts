import { createRequire } from 'node:module';
import { defineCommand, runMain } from 'citty';
import { checkCommand } from './commands/check.js';
import { compileCommand } from './commands/compile.js';
import { debugCommand } from './commands/debug.js';
import { extractCommand } from './commands/extract.js';
import { initCommand } from './commands/init.js';
import { statsCommand } from './commands/stats.js';
import { translateCommand } from './commands/translate.js';
import { setNonInteractive } from './ui/index.js';

const require = createRequire(import.meta.url);
const { version } = require('../../package.json') as { version: string };

// Load .env from the working directory, when there is one, with Node's own
// loader. The CLI imported dotenv, a devDependency, so a clean install
// crashed with "Cannot find package 'dotenv'". Values already set in the
// environment are kept, as dotenv kept them.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const main = defineCommand({
  meta: {
    name: 'idioma',
    version,
    description: 'Idioma i18n CLI - Compile-time React internationalization',
  },
  args: {
    'non-interactive': {
      type: 'boolean',
      description: 'Disable interactive UI (spinners, progress bars)',
      default: false,
      global: true,
    },
  },
  setup({ args }) {
    // Set non-interactive mode globally if flag is passed
    if (args['non-interactive']) {
      setNonInteractive(true);
    }
  },
  subCommands: {
    init: initCommand,
    extract: extractCommand,
    compile: compileCommand,
    check: checkCommand,
    stats: statsCommand,
    translate: translateCommand,
    debug: debugCommand,
  },
});

export { main };

// CLI entry point
export function run() {
  runMain(main);
}
