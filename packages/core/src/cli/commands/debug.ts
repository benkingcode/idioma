import { defineCommand } from 'citty';

export const debugCommand = defineCommand({
  meta: {
    name: 'debug',
    description: 'Debug utilities for library maintainers',
  },
  args: {},
  run() {
    console.log('Hello world');
  },
});
