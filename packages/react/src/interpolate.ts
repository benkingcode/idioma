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
 * Interpolates tags in a translated string with React components.
 * Supports both named tags (<Link>text</Link>) and numbered tags (<0>text</0>).
 * Also handles value placeholders ({name}, {0}) within the text.
 * Supports nested tags like <Bold>outer <Italic>inner</Italic></Bold>.
 *
 * @example
 * // Named tags (preferred)
 * interpolateTags(
 *   "Read our <TermsLink>terms</TermsLink> and <PrivacyLink>privacy</PrivacyLink>",
 *   [TermsLink, PrivacyLink],
 *   undefined,
 *   ['TermsLink', 'PrivacyLink']
 * )
 *
 * @example
 * // With placeholders
 * interpolateTags(
 *   "Hello {name}, click <Link>here</Link>",
 *   [Link],
 *   { name: "Ben" },
 *   ['Link']
 * )
 *
 * @example
 * // Duplicate component names (matched in order)
 * interpolateTags(
 *   "Click <Link>here</Link> or <Link>there</Link>",
 *   [LinkA, LinkB],
 *   undefined,
 *   ['Link', 'Link']
 * )
 */
export function interpolateTags(
  message: string,
  components: TransComponent[],
  args?: Record<string, unknown>,
  componentNames?: string[],
): ReactNode {
  // Parse the message into a tree structure, then render
  // Track which component indices have been used (for duplicate name matching)
  const usedIndices = new Set<number>();
  return parseAndRender(
    message,
    components,
    args,
    0,
    undefined,
    componentNames,
    usedIndices,
  ).result;
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
 * @param closingTag Optional: the closing tag we're looking for (e.g., "</Link>" or "</0>")
 * @param componentNames Optional: names of components in order (for named tag matching)
 * @param usedIndices Set tracking which component indices have been used
 */
function parseAndRender(
  message: string,
  components: TransComponent[],
  args: Record<string, unknown> | undefined,
  startIndex: number,
  closingTag?: string,
  componentNames?: string[],
  usedIndices?: Set<number>,
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

    // Check for opening tag - supports both named (<Link>) and numbered (<0>)
    // Named tags: <Link>, <Bold>, <MyComponent>
    // Numbered tags (legacy): <0>, <1>, <2>
    const openMatch = message.slice(i).match(/^<([a-zA-Z][a-zA-Z0-9]*|\d+)>/);
    if (openMatch) {
      // Add text before this tag
      if (i > textStart) {
        const text = message.slice(textStart, i);
        parts.push(args ? interpolateValues(text, args) : text);
      }

      const tagIdentifier = openMatch[1]!;
      const isNumbered = /^\d+$/.test(tagIdentifier);
      let tagIndex: number;

      if (isNumbered) {
        // Numbered tag: use the number directly as index
        tagIndex = parseInt(tagIdentifier, 10);
      } else {
        // Named tag: find the next unused component with this name
        tagIndex = findComponentIndex(
          tagIdentifier,
          componentNames,
          usedIndices,
        );
      }

      const tagClosing = `</${tagIdentifier}>`;
      const openTagLength = openMatch[0].length;

      // Mark this index as used
      usedIndices?.add(tagIndex);

      // Recursively parse the content inside this tag
      const innerResult = parseAndRender(
        message,
        components,
        args,
        i + openTagLength,
        tagClosing,
        componentNames,
        usedIndices,
      );

      const Component = components[tagIndex];
      if (Component) {
        parts.push(
          createElement(Component, {
            key: `${tagIdentifier}-${i}`,
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
      // Check for self-closing tag like <br/> or <Icon/>
      const selfCloseMatch = message
        .slice(i)
        .match(/^<([a-zA-Z][a-zA-Z0-9]*|\d+)\/>/);
      if (selfCloseMatch) {
        // Add text before this tag
        if (i > textStart) {
          const text = message.slice(textStart, i);
          parts.push(args ? interpolateValues(text, args) : text);
        }

        const tagIdentifier = selfCloseMatch[1]!;
        const isNumbered = /^\d+$/.test(tagIdentifier);
        let tagIndex: number;

        if (isNumbered) {
          tagIndex = parseInt(tagIdentifier, 10);
        } else {
          tagIndex = findComponentIndex(
            tagIdentifier,
            componentNames,
            usedIndices,
          );
        }

        // Mark this index as used
        usedIndices?.add(tagIndex);

        const Component = components[tagIndex];
        if (Component) {
          parts.push(
            createElement(Component, { key: `${tagIdentifier}-${i}` }),
          );
        }

        i += selfCloseMatch[0].length;
        textStart = i;
      } else {
        i++;
      }
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
 * Find the next unused component index matching the given name.
 * For duplicate names, returns them in order of first appearance.
 */
function findComponentIndex(
  name: string,
  componentNames?: string[],
  usedIndices?: Set<number>,
): number {
  if (!componentNames) {
    // No names provided, can't match - return -1 (will result in fallback)
    return -1;
  }

  // Find the first component with this name that hasn't been used yet
  for (let i = 0; i < componentNames.length; i++) {
    if (componentNames[i] === name && !usedIndices?.has(i)) {
      return i;
    }
  }

  // No match found - return -1
  return -1;
}

/**
 * Shared message rendering logic for both standard and Suspense runtimes.
 * Handles ICU-compiled functions, tag interpolation, and value interpolation.
 *
 * @param msg The message - either a string or a compiled ICU function
 * @param args Optional interpolation values
 * @param components Optional React components for tag interpolation
 * @param componentNames Optional component names for named tag matching
 */
export function renderMessage(
  msg: string | ((args: Record<string, unknown>) => string | ReactNode),
  args?: Record<string, unknown>,
  components?: TransComponent[],
  componentNames?: string[],
): ReactNode {
  // Compiled plural/ICU: msg is a function
  if (typeof msg === 'function') {
    return msg(args || {});
  }

  // String message - may need interpolation
  // Tag interpolation: replace <Link>...</Link> or <0>...</0> with React components
  // This must happen first if we have components, as it handles value interpolation too
  if (components && components.length > 0) {
    return interpolateTags(msg, components, args, componentNames);
  }

  // Value interpolation only: replace {name} or {0} with values from __a
  if (args && Object.keys(args).length > 0) {
    return interpolateValues(msg, args);
  }

  return msg;
}
