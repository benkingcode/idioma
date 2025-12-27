import { defineCommand } from 'citty';
import { displayGlobe } from '../ui/globe.js';
import { isInteractive } from '../ui/index.js';

export const debugCommand = defineCommand({
  meta: {
    name: 'debug',
    description: 'Debug utilities for library maintainers',
  },
  async run() {
    if (isInteractive()) {
      await displayGlobe();
    } else {
      console.log(
        'Debug command (non-interactive mode - globe animation skipped)',
      );
    }
  },
});
