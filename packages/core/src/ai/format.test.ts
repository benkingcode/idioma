import { describe, expect, it } from 'vitest';
import { formatBox, formatHeader, formatKeyValueList } from './format';

describe('formatBox', () => {
  it('creates a box with title and content', () => {
    const result = formatBox('Title', 'Hello world');

    expect(result).toContain('┌─ Title');
    expect(result).toContain('│ Hello world');
    expect(result).toContain('└');
  });

  it('handles multi-line content', () => {
    const result = formatBox('Test', 'Line 1\nLine 2\nLine 3');

    expect(result).toContain('│ Line 1');
    expect(result).toContain('│ Line 2');
    expect(result).toContain('│ Line 3');
  });

  it('wraps long lines instead of truncating', () => {
    const longLine =
      'This is a very long line that should wrap to multiple lines instead of being truncated with an ellipsis';
    const result = formatBox('Wrap', longLine);

    // Should NOT contain truncation indicator for regular text
    expect(result).not.toContain('...');

    // Should contain multiple lines
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(3); // top + wrapped content + bottom
  });

  it('truncates code block lines with ellipsis', () => {
    const codeBlock = `Some text
\`\`\`
${'const veryLongVariableName = '.repeat(10)}
\`\`\`
More text`;
    const result = formatBox('Code', codeBlock);

    // Should contain truncation indicator for code
    expect(result).toContain('...');
  });

  it('pads short lines to fixed width', () => {
    const result = formatBox('Short', 'Hi');

    // All lines should have the same width
    const lines = result.split('\n');
    const topLength = lines[0].length;
    const bottomLength = lines[lines.length - 1].length;

    expect(topLength).toBe(bottomLength);
  });

  it('wraps at word boundaries when possible', () => {
    const text =
      'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15';
    const result = formatBox('Words', text);

    // Check that words are not broken in the middle
    const lines = result.split('\n');
    const contentLines = lines.slice(1, -1); // Remove top and bottom borders

    for (const line of contentLines) {
      // Extract content between │ markers
      const content = line.slice(2, -2).trim();
      // Each word should be complete (no partial words like "wor" at end)
      if (content.length > 0) {
        const words = content.split(' ').filter((w) => w.length > 0);
        for (const word of words) {
          expect(word).toMatch(/^word\d+$/);
        }
      }
    }
  });
});

describe('formatHeader', () => {
  it('creates a section header with dashes', () => {
    const result = formatHeader('My Section');

    expect(result).toContain('─');
    expect(result).toContain('My Section');
  });

  it('has dashes on both sides', () => {
    const result = formatHeader('Test');

    // Should have dashes before and after the text
    const parts = result.split('Test');
    expect(parts[0]).toContain('─');
    expect(parts[1]).toContain('─');
  });
});

describe('formatKeyValueList', () => {
  it('formats key-value pairs', () => {
    const result = formatKeyValueList([
      { key: 'abc', value: 'Hello' },
      { key: 'def', value: 'World' },
    ]);

    expect(result).toContain('abc → "Hello"');
    expect(result).toContain('def → "World"');
  });

  it('indents each line', () => {
    const result = formatKeyValueList([{ key: 'test', value: 'value' }]);

    expect(result.startsWith('  ')).toBe(true);
  });

  it('handles empty array', () => {
    const result = formatKeyValueList([]);

    expect(result).toBe('');
  });
});
