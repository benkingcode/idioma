/**
 * Formatting utilities for verbose logging output.
 */

const BOX_WIDTH = 78;
const CONTENT_WIDTH = BOX_WIDTH - 4; // Account for "│ " and " │"

/**
 * Wrap a line of text to fit within the box width.
 * Tries to break at word boundaries when possible.
 */
function wrapLine(line: string, maxWidth: number): string[] {
  if (line.length <= maxWidth) {
    return [line];
  }

  const wrapped: string[] = [];
  let remaining = line;

  while (remaining.length > maxWidth) {
    // Try to find a space to break at
    let breakPoint = remaining.lastIndexOf(' ', maxWidth);

    // If no space found, or it's too far back, just break at maxWidth
    if (breakPoint === -1 || breakPoint < maxWidth * 0.5) {
      breakPoint = maxWidth;
    }

    wrapped.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  if (remaining) {
    wrapped.push(remaining);
  }

  return wrapped;
}

/**
 * Format content in an ASCII box with a title.
 * Text wraps by default, but code blocks (inside ```) are truncated.
 *
 * Example output:
 * ┌─ Title ────────────────────────────────────────────────────────────────────┐
 * │ Content line 1                                                             │
 * │ Content line 2                                                             │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export function formatBox(title: string, content: string): string {
  const inputLines = content.split('\n');

  // Build top border: ┌─ Title ─────...─┐
  const titlePart = `─ ${title} `;
  const remainingWidth = BOX_WIDTH - titlePart.length - 2; // -2 for ┌ and ┐
  const top = `┌${titlePart}${'─'.repeat(Math.max(0, remainingWidth))}┐`;

  // Build bottom border: └─────...─┘
  const bottom = `└${'─'.repeat(BOX_WIDTH - 2)}┘`;

  // Process lines - wrap text but truncate code blocks
  let inCodeBlock = false;
  const outputLines: string[] = [];

  for (const line of inputLines) {
    // Check for code block markers
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    if (inCodeBlock || line.trim().startsWith('```')) {
      // Truncate code block lines
      const truncated =
        line.length > CONTENT_WIDTH
          ? line.slice(0, CONTENT_WIDTH - 3) + '...'
          : line;
      outputLines.push(truncated);
    } else {
      // Wrap regular text
      const wrapped = wrapLine(line, CONTENT_WIDTH);
      outputLines.push(...wrapped);
    }
  }

  // Build body with padding
  const body = outputLines
    .map((line) => {
      const padded = line.padEnd(CONTENT_WIDTH);
      return `│ ${padded} │`;
    })
    .join('\n');

  return `${top}\n${body}\n${bottom}`;
}

/**
 * Format a section header for verbose output.
 *
 * Example: ─── Context Generation: src/App.tsx (3 messages) ───
 */
export function formatHeader(text: string): string {
  const padding = Math.max(0, Math.floor((BOX_WIDTH - text.length - 6) / 2));
  return `${'─'.repeat(padding)}── ${text} ──${'─'.repeat(padding)}`;
}

/**
 * Format a list of key-value pairs for display in a response box.
 *
 * Example:
 *   abc123 → "¡Hola, mundo!"
 *   def456 → "Welcome"
 */
export function formatKeyValueList(
  items: Array<{ key: string; value: string }>,
): string {
  return items.map((item) => `  ${item.key} → "${item.value}"`).join('\n');
}
