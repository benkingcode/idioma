import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { __useT } from './useT'
import { createIdiomaProvider } from './context'

const IdiomaProvider = createIdiomaProvider()

describe('__useT', () => {
  const translations = {
    greeting: {
      en: 'Hello',
      es: 'Hola',
    },
    'greeting.name': {
      en: 'Hello {name}!',
      es: '¡Hola {name}!',
    },
    'items.count': {
      en: ({ count }: { count: number }) =>
        count === 1 ? '1 item' : `${count} items`,
      es: ({ count }: { count: number }) =>
        count === 1 ? '1 artículo' : `${count} artículos`,
    },
  }

  it('returns a translator function', () => {
    function TestComponent() {
      const t = __useT(translations)
      return <div data-testid="result">{t('greeting')}</div>
    }

    render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('Hello')
  })

  it('translates to the current locale', () => {
    function TestComponent() {
      const t = __useT(translations)
      return <div data-testid="result">{t('greeting')}</div>
    }

    render(
      <IdiomaProvider locale="es">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('Hola')
  })

  it('interpolates values', () => {
    function TestComponent() {
      const t = __useT(translations)
      return (
        <div data-testid="result">{t('greeting.name', { name: 'Ben' })}</div>
      )
    }

    render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('Hello Ben!')
  })

  it('handles function messages (compiled plurals)', () => {
    function TestComponent() {
      const t = __useT(translations)
      return (
        <div data-testid="result">{t('items.count', { count: 5 })}</div>
      )
    }

    render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('5 items')
  })

  it('handles function messages with count of 1', () => {
    function TestComponent() {
      const t = __useT(translations)
      return (
        <div data-testid="result">{t('items.count', { count: 1 })}</div>
      )
    }

    render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('1 item')
  })

  it('returns key if translation is missing', () => {
    function TestComponent() {
      const t = __useT(translations)
      return <div data-testid="result">{t('nonexistent.key')}</div>
    }

    render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('nonexistent.key')
  })

  it('updates when locale changes', () => {
    function TestComponent() {
      const t = __useT(translations)
      return <div data-testid="result">{t('greeting')}</div>
    }

    const { rerender } = render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('Hello')

    rerender(
      <IdiomaProvider locale="es">
        <TestComponent />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('result').textContent).toBe('Hola')
  })
})
