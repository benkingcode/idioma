import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createIdiomaProvider } from './context';
import { generateKey } from './server/generateKey';
import { __useT } from './useT';

const IdiomaProvider = createIdiomaProvider();

describe('__useT', () => {
  // Translations keyed by hash for source text mode
  const translations = {
    // Source text translations (keyed by hash)
    [generateKey('Hello world!')]: {
      en: 'Hello world!',
      es: '¡Hola mundo!',
    },
    [generateKey('Hello {name}')]: {
      en: 'Hello {name}',
      es: 'Hola {name}',
    },
    [generateKey('Submit', 'button')]: {
      en: 'Submit',
      es: 'Enviar',
    },
    // Key-only translations (manual ids)
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
  };

  describe('Babel-inlined mode', () => {
    it('translates using Babel-inlined translations', () => {
      // Babel transforms: t('source', { __m: { en: '...', es: '...' } })
      function TestComponent() {
        const t = __useT(translations);
        // Second arg is Babel-inlined: { __m: { locale: translation } }
        return (
          <div data-testid="result">
            {t('Hello world!', {
              __m: {
                en: 'Hello world!',
                es: '¡Hola mundo!',
              },
            } as unknown as Record<string, unknown>)}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('¡Hola mundo!');
    });

    it('interpolates values with Babel-inlined translations', () => {
      // Babel transforms: t('source', { __m: { en: '...', es: '...' } }, { values })
      function TestComponent() {
        const t = __useT(translations);
        return (
          <div data-testid="result">
            {t(
              'Hello {name}',
              {
                __m: {
                  en: 'Hello {name}',
                  es: 'Hola {name}',
                },
              } as unknown as Record<string, unknown>,
              { name: 'Ben' } as unknown as undefined,
            )}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hola Ben');
    });

    it('handles function messages (compiled plurals) with Babel inlining', () => {
      function TestComponent() {
        const t = __useT(translations);
        return (
          <div data-testid="result">
            {t(
              '{count} items',
              {
                __m: {
                  en: ({ count }: { count: number }) =>
                    count === 1 ? '1 item' : `${count} items`,
                  es: ({ count }: { count: number }) =>
                    count === 1 ? '1 artículo' : `${count} artículos`,
                },
              } as unknown as Record<string, unknown>,
              { count: 5 } as unknown as undefined,
            )}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('5 items');
    });
  });

  describe('key-only mode', () => {
    it('returns a translator function', () => {
      function TestComponent() {
        const t = __useT(translations);
        return <div data-testid="result">{t({ id: 'greeting' })}</div>;
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello');
    });

    it('translates to the current locale', () => {
      function TestComponent() {
        const t = __useT(translations);
        return <div data-testid="result">{t({ id: 'greeting' })}</div>;
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hola');
    });

    it('interpolates values', () => {
      function TestComponent() {
        const t = __useT(translations);
        return (
          <div data-testid="result">
            {t({ id: 'greeting.name', values: { name: 'Ben' } })}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello Ben!');
    });

    it('handles function messages (compiled plurals)', () => {
      function TestComponent() {
        const t = __useT(translations);
        return (
          <div data-testid="result">
            {t({ id: 'items.count', values: { count: 5 } })}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('5 items');
    });

    it('handles function messages with count of 1', () => {
      function TestComponent() {
        const t = __useT(translations);
        return (
          <div data-testid="result">
            {t({ id: 'items.count', values: { count: 1 } })}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('1 item');
    });

    it('returns id if translation is missing', () => {
      function TestComponent() {
        const t = __useT(translations);
        return <div data-testid="result">{t({ id: 'nonexistent.key' })}</div>;
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('nonexistent.key');
    });
  });

  it('updates when locale changes', () => {
    function TestComponent() {
      const t = __useT(translations);
      return <div data-testid="result">{t({ id: 'greeting' })}</div>;
    }

    const { rerender } = render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId('result').textContent).toBe('Hello');

    rerender(
      <IdiomaProvider locale="es">
        <TestComponent />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId('result').textContent).toBe('Hola');
  });

  describe('graceful fallback when translation is missing', () => {
    it('returns source text and logs warning when translation not found', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      function TestComponent() {
        const t = __useT({}); // Empty translations - simulates Babel not transforming
        return <div data-testid="result">{t('Hello world')}</div>;
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello world');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Idioma: Missing translations'),
      );

      consoleSpy.mockRestore();
    });

    it('returns interpolated source text when values provided', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      function TestComponent() {
        const t = __useT({});
        return (
          <div data-testid="result">{t('Hello {name}', { name: 'Ben' })}</div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello Ben');

      consoleSpy.mockRestore();
    });

    it('does not log warning in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      function TestComponent() {
        const t = __useT({});
        return <div data-testid="result">{t('Hello world')}</div>;
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello world');
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});
