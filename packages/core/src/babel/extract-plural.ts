import * as t from '@babel/types'
import generate from '@babel/generator'

export interface PluralIcuResult {
  /** The ICU plural message */
  icu: string
  /** The variable name used for the count */
  variable: string
}

// Valid plural form names in order
const PLURAL_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other'] as const
type PluralForm = (typeof PLURAL_FORMS)[number]

/**
 * Serialize a Plural JSX element to ICU MessageFormat.
 *
 * Converts:
 *   <Plural value={count} one="# item" other="# items" />
 * To:
 *   {count, plural, one {# item} other {# items}}
 */
export function serializePluralToIcu(element: t.JSXElement): PluralIcuResult {
  const opening = element.openingElement

  // Extract props
  const props = new Map<string, string>()
  let variable: string | null = null

  for (const attr of opening.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) continue

    const name = attr.name.name

    if (name === 'value') {
      // Extract the variable expression
      if (t.isJSXExpressionContainer(attr.value)) {
        variable = generate(attr.value.expression).code
      }
    } else if (PLURAL_FORMS.includes(name as PluralForm)) {
      // Extract the form string
      if (t.isStringLiteral(attr.value)) {
        props.set(name, attr.value.value)
      } else if (
        t.isJSXExpressionContainer(attr.value) &&
        t.isStringLiteral(attr.value.expression)
      ) {
        props.set(name, attr.value.expression.value)
      }
    }
  }

  // Validate required props
  if (!variable) {
    throw new Error('Plural requires a value prop')
  }

  if (!props.has('other')) {
    throw new Error('Plural requires an "other" form')
  }

  // Build ICU message
  const forms: string[] = []

  for (const form of PLURAL_FORMS) {
    if (props.has(form)) {
      const formText = escapeIcuSpecialChars(props.get(form)!)
      forms.push(`${form} {${formText}}`)
    }
  }

  const icu = `{${variable}, plural, ${forms.join(' ')}}`

  return { icu, variable }
}

/**
 * Escape special ICU characters in form text.
 * Curly braces { and } need to be escaped as '{' and '}' in ICU.
 * But # should NOT be escaped as it's a special ICU placeholder.
 */
function escapeIcuSpecialChars(text: string): string {
  // Escape { and } but not #
  return text.replace(/\{/g, "'{").replace(/\}/g, "}'")
}
