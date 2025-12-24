import { describe, it, expect } from 'vitest'
import * as parser from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import { serializeJsxChildren, type SerializeResult } from './serialize'

function parseJsx(code: string): t.JSXElement {
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  })

  let jsxElement: t.JSXElement | null = null

  traverse(ast, {
    JSXElement(path) {
      jsxElement = path.node
      path.stop()
    },
  })

  if (!jsxElement) {
    throw new Error('No JSX element found')
  }

  return jsxElement
}

function getChildren(code: string): t.JSXElement['children'] {
  return parseJsx(code).children
}

describe('serializeJsxChildren', () => {
  it('serializes simple text', () => {
    const children = getChildren('<Trans>Hello world</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Hello world')
    expect(result.placeholders).toEqual({})
    expect(result.components).toEqual([])
  })

  it('serializes text with simple identifier placeholder', () => {
    const children = getChildren('<Trans>Hello {name}</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Hello {name}')
    expect(result.placeholders).toEqual({ name: 'name' })
  })

  it('serializes text with member expression placeholder', () => {
    const children = getChildren('<Trans>Hello {user.name}</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Hello {user.name}')
    expect(result.placeholders).toEqual({ 'user.name': 'user.name' })
  })

  it('serializes complex expression as numbered placeholder', () => {
    const children = getChildren('<Trans>Count: {getCount()}</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Count: {0}')
    expect(result.placeholders).toEqual({ '0': 'getCount()' })
    expect(result.comments).toContain('{0} = getCount()')
  })

  it('serializes JSX element as numbered tag', () => {
    const children = getChildren('<Trans>Click <Link>here</Link> to continue</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Click <0>here</0> to continue')
    expect(result.components).toEqual(['Link'])
  })

  it('serializes multiple JSX elements with correct numbering', () => {
    const children = getChildren('<Trans><Bold>Hello</Bold> and <Italic>world</Italic></Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('<0>Hello</0> and <1>world</1>')
    expect(result.components).toEqual(['Bold', 'Italic'])
  })

  it('serializes self-closing JSX element', () => {
    const children = getChildren('<Trans>Line break<br/>here</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Line break<0/>here')
    expect(result.components).toEqual(['br'])
  })

  it('serializes nested JSX elements', () => {
    const children = getChildren('<Trans><Bold><Italic>text</Italic></Bold></Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('<0><1>text</1></0>')
    expect(result.components).toEqual(['Bold', 'Italic'])
  })

  it('serializes placeholders inside JSX elements', () => {
    const children = getChildren('<Trans><Link>Hello {name}</Link></Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('<0>Hello {name}</0>')
    expect(result.placeholders).toEqual({ name: 'name' })
    expect(result.components).toEqual(['Link'])
  })

  it('handles multiple numbered placeholders', () => {
    const children = getChildren('<Trans>Results: {fn1()} and {fn2()}</Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Results: {0} and {1}')
    expect(result.placeholders['0']).toBe('fn1()')
    expect(result.placeholders['1']).toBe('fn2()')
  })

  it('trims and normalizes whitespace', () => {
    const children = getChildren(`<Trans>
      Hello   world
    </Trans>`)
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('Hello world')
  })

  it('handles empty Trans', () => {
    const children = getChildren('<Trans></Trans>')
    const result = serializeJsxChildren(children)

    expect(result.message).toBe('')
  })

  it('handles JSX fragment children', () => {
    const children = getChildren('<Trans><>fragment content</></Trans>')
    const result = serializeJsxChildren(children)

    // Fragment content should be flattened
    expect(result.message).toBe('fragment content')
  })
})
