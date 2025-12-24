import { defineCommand, runMain } from 'citty';
import { checkCommand } from './commands/check';
import { compileCommand } from './commands/compile';
import { extractCommand } from './commands/extract';
import { statsCommand } from './commands/stats';
import { translateCommand } from './commands/translate';

const main = defineCommand({
  meta: {
    name: 'idioma',
    version: '0.1.0',
    description: 'Idioma i18n CLI - Compile-time React internationalization',
  },
  subCommands: {
    extract: extractCommand,
    compile: compileCommand,
    check: checkCommand,
    stats: statsCommand,
    translate: translateCommand,
  },
});

export { main };

// CLI entry point
export function run() {
  runMain(main);
}
