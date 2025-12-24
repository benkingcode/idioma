import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { __Trans } from './Trans'
import { createIdiomaProvider } from './context'

const IdiomaProvider = createIdiomaProvider()

describe('__Trans', () => {
  it('renders a simple string for the current locale', () => {
    render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello',
            es: 'Hola',
          }}
        />
      </IdiomaProvider>
    )

    expect(screen.getByText('Hello')).toBeDefined()
  })

  it('switches locale dynamically', () => {
    const { rerender } = render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello',
            es: 'Hola',
          }}
        />
      </IdiomaProvider>
    )

    expect(screen.getByText('Hello')).toBeDefined()

    rerender(
      <IdiomaProvider locale="es">
        <__Trans
          __t={{
            en: 'Hello',
            es: 'Hola',
          }}
        />
      </IdiomaProvider>
    )

    expect(screen.getByText('Hola')).toBeDefined()
  })

  it('interpolates values with __a prop', () => {
    render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello {name}!',
            es: 'Hola {name}!',
          }}
          __a={{ name: 'Ben' }}
        />
      </IdiomaProvider>
    )

    expect(screen.getByText('Hello Ben!')).toBeDefined()
  })

  it('interpolates components with __c prop', () => {
    const Bold = ({ children }: { children: React.ReactNode }) => (
      <strong data-testid="bold">{children}</strong>
    )

    render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello <0>world</0>!',
            es: 'Hola <0>mundo</0>!',
          }}
          __c={[Bold]}
        />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('bold').textContent).toBe('world')
  })

  it('handles function messages (compiled plurals)', () => {
    render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: ({ count }: { count: number }) =>
              count === 1 ? '1 item' : `${count} items`,
            es: ({ count }: { count: number }) =>
              count === 1 ? '1 artículo' : `${count} artículos`,
          }}
          __a={{ count: 5 }}
        />
      </IdiomaProvider>
    )

    expect(screen.getByText('5 items')).toBeDefined()
  })

  it('handles function messages with count of 1', () => {
    render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: ({ count }: { count: number }) =>
              count === 1 ? '1 item' : `${count} items`,
            es: ({ count }: { count: number }) =>
              count === 1 ? '1 artículo' : `${count} artículos`,
          }}
          __a={{ count: 1 }}
        />
      </IdiomaProvider>
    )

    expect(screen.getByText('1 item')).toBeDefined()
  })

  it('handles both values and components together', () => {
    const Link = ({ children }: { children: React.ReactNode }) => (
      <a data-testid="link">{children}</a>
    )

    render(
      <IdiomaProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello {name}, click <0>here</0>!',
            es: 'Hola {name}, haz clic <0>aquí</0>!',
          }}
          __a={{ name: 'Ben' }}
          __c={[Link]}
        />
      </IdiomaProvider>
    )

    expect(screen.getByTestId('link').textContent).toBe('here')
    // The full text should contain "Hello Ben"
    expect(screen.getByText(/Hello Ben/)).toBeDefined()
  })
})
