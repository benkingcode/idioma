import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Plural, plural } from './pluralization'

describe('Plural', () => {
  it('renders the "other" form with value substituted (dev mode)', () => {
    render(
      <div data-testid="result">
        <Plural value={5} one="# item" other="# items" />
      </div>
    )

    expect(screen.getByTestId('result').textContent).toBe('5 items')
  })

  it('renders the "one" form when value is 1', () => {
    render(
      <div data-testid="result">
        <Plural value={1} one="# item" other="# items" />
      </div>
    )

    // In dev mode, we use simple English rules
    expect(screen.getByTestId('result').textContent).toBe('1 item')
  })

  it('handles zero value', () => {
    render(
      <div data-testid="result">
        <Plural value={0} zero="no items" one="# item" other="# items" />
      </div>
    )

    // zero form should be used when value is 0 and zero is provided
    expect(screen.getByTestId('result').textContent).toBe('no items')
  })

  it('falls back to other when zero not provided', () => {
    render(
      <div data-testid="result">
        <Plural value={0} one="# item" other="# items" />
      </div>
    )

    expect(screen.getByTestId('result').textContent).toBe('0 items')
  })
})

describe('plural', () => {
  it('returns the "other" form with value substituted', () => {
    const result = plural(5, { one: '# item', other: '# items' })
    expect(result).toBe('5 items')
  })

  it('returns the "one" form when value is 1', () => {
    const result = plural(1, { one: '# item', other: '# items' })
    expect(result).toBe('1 item')
  })

  it('handles zero form', () => {
    const result = plural(0, { zero: 'no items', one: '# item', other: '# items' })
    expect(result).toBe('no items')
  })

  it('falls back to other when zero not provided', () => {
    const result = plural(0, { one: '# item', other: '# items' })
    expect(result).toBe('0 items')
  })
})
