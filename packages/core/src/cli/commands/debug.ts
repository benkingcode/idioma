import { defineCommand } from 'citty';
import { displayGlobe, type GlobeStyle } from '../ui/globe.js';
import { isInteractive } from '../ui/index.js';

export const debugCommand = defineCommand({
  meta: {
    name: 'debug',
    description: 'Debug utilities for library maintainers',
  },
  args: {
    style: {
      type: 'string',
      description: 'Globe style: tiny, simple, or detailed',
      default: 'detailed',
    },
  },
  async run({ args }) {
    const style = (
      ['tiny', 'simple', 'detailed'].includes(args.style ?? '')
        ? args.style
        : 'detailed'
    ) as GlobeStyle;

    if (isInteractive()) {
      await displayGlobe(style);
    } else {
      console.log(
        'Debug command (non-interactive mode - globe animation skipped)',
      );
    }
  },
});
