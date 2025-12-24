import {
  parse,
  TYPE,
  type MessageFormatElement,
  type PluralElement,
  type SelectElement,
  type ArgumentElement,
  type LiteralElement,
  type PluralOrSelectOption,
} from '@formatjs/icu-messageformat-parser'

export interface IcuAnalysis {
  /** Whether the message contains any placeholders */
  hasPlaceholders: boolean
  /** Whether the message contains plural formatting */
  hasPlural: boolean
  /** Whether the message contains select formatting */
  hasSelect: boolean
  /** List of variable names used in the message */
  variables: string[]
}

/**
 * Analyze an ICU message to determine its structure.
 */
export function analyzeIcuMessage(message: string): IcuAnalysis {
  const ast = parse(message)

  const result: IcuAnalysis = {
    hasPlaceholders: false,
    hasPlural: false,
    hasSelect: false,
    variables: [],
  }

  const variableSet = new Set<string>()

  function visitElements(elements: MessageFormatElement[]) {
    for (const el of elements) {
      switch (el.type) {
        case TYPE.argument:
          result.hasPlaceholders = true
          variableSet.add(el.value)
          break

        case TYPE.plural:
          result.hasPlural = true
          result.hasPlaceholders = true
          variableSet.add(el.value)
          // Visit nested elements in each option
          for (const option of Object.values(el.options)) {
            visitElements(option.value)
          }
          break

        case TYPE.select:
          result.hasSelect = true
          result.hasPlaceholders = true
          variableSet.add(el.value)
          // Visit nested elements in each option
          for (const option of Object.values(el.options)) {
            visitElements(option.value)
          }
          break

        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          result.hasPlaceholders = true
          variableSet.add(el.value)
          break
      }
    }
  }

  visitElements(ast)
  result.variables = Array.from(variableSet)

  return result
}

/**
 * Compile an ICU message to a JavaScript function.
 *
 * For simple messages without placeholders, returns a function that returns the string.
 * For messages with placeholders, returns a function that interpolates values.
 * For plural/select messages, uses Intl.PluralRules for locale-aware formatting.
 */
export function compileIcuToFunction(
  message: string,
  locale: string
): (args: Record<string, unknown>) => string {
  const ast = parse(message)

  // For simple literal-only messages, return a constant function
  const firstElement = ast[0]
  if (ast.length === 1 && firstElement && firstElement.type === TYPE.literal) {
    const text = (firstElement as LiteralElement).value
    return () => text
  }

  // Create the interpolation function
  return (args: Record<string, unknown>): string => {
    return formatElements(ast, args, locale)
  }
}

function formatElements(
  elements: MessageFormatElement[],
  args: Record<string, unknown>,
  locale: string
): string {
  let result = ''

  for (const el of elements) {
    switch (el.type) {
      case TYPE.literal:
        result += (el as LiteralElement).value
        break

      case TYPE.argument:
        result += String(args[(el as ArgumentElement).value] ?? '')
        break

      case TYPE.plural:
        result += formatPlural(el as PluralElement, args, locale)
        break

      case TYPE.select:
        result += formatSelect(el as SelectElement, args, locale)
        break

      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        // Basic number/date/time formatting
        result += String(args[el.value] ?? '')
        break

      case TYPE.pound:
        // # in plural - this should not appear at top level
        // It's handled within formatPluralOption
        break

      default:
        // Handle any other element types
        break
    }
  }

  return result
}

function formatPlural(
  el: PluralElement,
  args: Record<string, unknown>,
  locale: string
): string {
  const value = Number(args[el.value])
  const offset = el.offset || 0
  const adjustedValue = value - offset

  // First, check for exact match (=0, =1, etc.)
  for (const [key, option] of Object.entries(el.options)) {
    if (key.startsWith('=')) {
      const exactValue = parseInt(key.slice(1), 10)
      if (value === exactValue) {
        return formatPluralOption(option, adjustedValue, args, locale)
      }
    }
  }

  // Special handling: treat "zero" as =0 for languages without a zero category
  // This makes the API more intuitive for English developers
  if (value === 0 && el.options.zero) {
    return formatPluralOption(el.options.zero, adjustedValue, args, locale)
  }

  // Use Intl.PluralRules for category matching
  const pluralRules = new Intl.PluralRules(locale)
  const category = pluralRules.select(adjustedValue)

  // Try to find the matching category
  if (el.options[category]) {
    return formatPluralOption(el.options[category], adjustedValue, args, locale)
  }

  // Fall back to 'other'
  if (el.options.other) {
    return formatPluralOption(el.options.other, adjustedValue, args, locale)
  }

  return ''
}

function formatPluralOption(
  option: PluralOrSelectOption,
  value: number,
  args: Record<string, unknown>,
  locale: string
): string {
  let result = ''

  for (const el of option.value) {
    if (el.type === TYPE.pound) {
      result += String(value)
    } else if (el.type === TYPE.literal) {
      result += (el as LiteralElement).value
    } else {
      result += formatElements([el], args, locale)
    }
  }

  return result
}

function formatSelect(
  el: SelectElement,
  args: Record<string, unknown>,
  locale: string
): string {
  const value = String(args[el.value] ?? '')

  // Try to find matching option
  if (el.options[value]) {
    return formatElements(el.options[value].value, args, locale)
  }

  // Fall back to 'other'
  if (el.options.other) {
    return formatElements(el.options.other.value, args, locale)
  }

  return ''
}
