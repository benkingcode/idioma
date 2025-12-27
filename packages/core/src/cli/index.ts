import { defineCommand, runMain } from 'citty';
import { config as loadDotenv } from 'dotenv';
import { checkCommand } from './commands/check.js';
import { compileCommand } from './commands/compile.js';
import { debugCommand } from './commands/debug.js';
import { extractCommand } from './commands/extract.js';
import { statsCommand } from './commands/stats.js';
import { translateCommand } from './commands/translate.js';
import { setNonInteractive } from './ui/index.js';

// Load .env file from current working directory
loadDotenv({ quiet: true });

const main = defineCommand({
  meta: {
    name: 'idioma',
    version: '0.1.0',
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
