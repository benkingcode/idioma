import { Fragment, createElement, type ReactNode, type ComponentType } from 'react'

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
  args: Record<string, unknown>
): string {
  return message.replace(/\{([^}]+)\}/g, (match, key: string) => {
    const value = args[key]
    if (value === undefined) {
      // Keep placeholder if no value provided (helps debugging)
      return match
    }
    return String(value)
  })
}

export type TransComponent = ComponentType<{ children: ReactNode }>

/**
 * Interpolates numbered tags in a translated string with React components.
 * Also handles value placeholders ({name}, {0}) within the text.
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
 */
export function interpolateTags(
  message: string,
  components: TransComponent[],
  args?: Record<string, unknown>
): ReactNode {
  const parts: ReactNode[] = []
  let lastIndex = 0

  // Match <0>content</0>, <1>content</1>, etc.
  const tagRegex = /<(\d+)>([^<]*)<\/\1>/g
  let match

  while ((match = tagRegex.exec(message)) !== null) {
    const matchIndex = match[1]!
    const matchContent = match[2]!

    // Add text before this tag (with value interpolation)
    if (match.index > lastIndex) {
      const textBefore = message.slice(lastIndex, match.index)
      parts.push(args ? interpolateValues(textBefore, args) : textBefore)
    }

    const componentIndex = parseInt(matchIndex, 10)
    const innerText = matchContent
    const Component = components[componentIndex]

    if (Component) {
      // Interpolate values within the inner text too
      const interpolatedInner = args
        ? interpolateValues(innerText, args)
        : innerText
      parts.push(
        createElement(Component, { key: componentIndex, children: interpolatedInner })
      )
    } else {
      // Fallback if component not provided
      parts.push(args ? interpolateValues(innerText, args) : innerText)
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text (with value interpolation)
  if (lastIndex < message.length) {
    const remaining = message.slice(lastIndex)
    parts.push(args ? interpolateValues(remaining, args) : remaining)
  }

  // Return string if single text part, otherwise Fragment
  if (parts.length === 0) {
    return message
  }
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return parts[0]
  }
  return createElement(Fragment, null, ...parts)
}
