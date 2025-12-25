import {
  createElement,
  Fragment,
  type ComponentType,
  type ReactNode,
} from 'react';

/**
 * Interpolates values into a message string.
 * Handles both named placeholders ({user.name}) and numbered ({0}).
 *
 * @example
 * interpolateValues("Hello {name}!", { name: "Ben" })
 * // => "Hello Ben!"
 *
 * @example
 * interpolateValues("Total: {0} items", { "0": 42 })
 * // => "Total: 42 items"
 */
export function interpolateValues(
  message: string,
  args: Record<string, unknown>,
): string {
  return message.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const value = args[key];
    if (value === undefined) {
      // Keep placeholder if no value provided (helps debugging)
      return match;
    }
    return String(value);
  });
}

export type TransComponent = ComponentType<{ children?: ReactNode }>;

/**
 * Interpolates numbered tags in a translated string with React components.
 * Also handles value placeholders ({name}, {0}) within the text.
 * Supports nested tags like <0>outer <1>inner</1></0>.
 *
 * @example
 * interpolateTags(
 *   "Read our <0>terms</0> and <1>privacy</1>",
 *   [TermsLink, PrivacyLink]
 * )
 *
 * @example
 * interpolateTags(
 *   "Hello {name}, click <0>here</0>",
 *   [Link],
 *   { name: "Ben" }
 * )
 *
 * @example
 * // Nested tags
 * interpolateTags(
 *   "<0>Important: <1>read carefully</1></0>",
 *   [Bold, Italic]
 * )
 */
export function interpolateTags(
  message: string,
  components: TransComponent[],
  args?: Record<string, unknown>,
): ReactNode {
  // Parse the message into a tree structure, then render
  return parseAndRender(message, components, args, 0).result;
}

interface ParseResult {
  result: ReactNode;
  endIndex: number;
}

/**
 * Recursively parse and render tags starting from a given position.
 * @param message The full message string
 * @param components Array of React components for tag substitution
 * @param args Optional interpolation values
 * @param startIndex Where to start parsing
 * @param closingTag Optional: the closing tag we're looking for (e.g., "</0>")
 */
function parseAndRender(
  message: string,
  components: TransComponent[],
  args: Record<string, unknown> | undefined,
  startIndex: number,
  closingTag?: string,
): ParseResult {
  const parts: ReactNode[] = [];
  let i = startIndex;
  let textStart = startIndex;

  while (i < message.length) {
    // Check for closing tag if we're inside a tag
    if (closingTag && message.startsWith(closingTag, i)) {
      // Add any remaining text before the closing tag
      if (i > textStart) {
        const text = message.slice(textStart, i);
        parts.push(args ? interpolateValues(text, args) : text);
      }
      return {
        result:
          parts.length === 1
            ? parts[0]!
            : createElement(Fragment, null, ...parts),
        endIndex: i + closingTag.length,
      };
    }

    // Check for opening tag like <0>, <1>, etc.
    const openMatch = message.slice(i).match(/^<(\d+)>/);
    if (openMatch) {
      // Add text before this tag
      if (i > textStart) {
        const text = message.slice(textStart, i);
        parts.push(args ? interpolateValues(text, args) : text);
      }

      const tagIndex = parseInt(openMatch[1]!, 10);
      const tagClosing = `</${tagIndex}>`;
      const openTagLength = openMatch[0].length;

      // Recursively parse the content inside this tag
      const innerResult = parseAndRender(
        message,
        components,
        args,
        i + openTagLength,
        tagClosing,
      );

      const Component = components[tagIndex];
      if (Component) {
        parts.push(
          createElement(Component, {
            key: `${tagIndex}-${i}`,
            children: innerResult.result,
          }),
        );
      } else {
        // Fallback: just include the inner content without wrapper
        parts.push(innerResult.result);
      }

      i = innerResult.endIndex;
      textStart = i;
    } else {
      i++;
    }
  }

  // Add any remaining text
  if (textStart < message.length) {
    const text = message.slice(textStart);
    parts.push(args ? interpolateValues(text, args) : text);
  }

  // Simplify the result
  if (parts.length === 0) {
    return { result: '', endIndex: i };
  }
  if (parts.length === 1) {
    return { result: parts[0]!, endIndex: i };
  }
  return { result: createElement(Fragment, null, ...parts), endIndex: i };
}

/**
 * Shared message rendering logic for both standard and Suspense runtimes.
 * Handles ICU-compiled functions, tag interpolation, and value interpolation.
 *
 * @param msg The message - either a string or a compiled ICU function
 * @param args Optional interpolation values
 * @param components Optional React components for tag interpolation
 */
export function renderMessage(
  msg: string | ((args: Record<string, unknown>) => string | ReactNode),
  args?: Record<string, unknown>,
  components?: TransComponent[],
): ReactNode {
  // Compiled plural/ICU: msg is a function
  if (typeof msg === 'function') {
    return msg(args || {});
  }

  // String message - may need interpolation
  // Tag interpolation: replace <0>...</0> with React components
  // This must happen first if we have components, as it handles value interpolation too
  if (components && components.length > 0) {
    return interpolateTags(msg, components, args);
  }

  // Value interpolation only: replace {name} or {0} with values from __a
  if (args && Object.keys(args).length > 0) {
    return interpolateValues(msg, args);
  }

  return msg;
}
