import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createIdiomaProvider } from './context';
import { createUseT } from './createUseT';

const IdiomaProvider = createIdiomaProvider();
const useT = createUseT();

describe('createUseT', () => {
  describe('source text mode fallback (without Babel transformation)', () => {
    it('returns source text when not transformed by Babel', () => {
      function TestComponent() {
        const t = useT();
        return <div data-testid="result">{t('Hello world!')}</div>;
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      // Without Babel transformation, returns source text as fallback
      expect(screen.getByTestId('result').textContent).toBe('Hello world!');
    });

    it('interpolates values in source text even without Babel transformation', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">{t('Hello {name}', { name: 'Ben' })}</div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      // Interpolates values in the source text fallback
      expect(screen.getByTestId('result').textContent).toBe('Hello Ben');
    });

    it('returns interpolated source when context provided but not transformed', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">
            {t('Hello {name}', { name: 'Ben' }, { context: 'greeting' })}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      // Falls back to interpolated source
      expect(screen.getByTestId('result').textContent).toBe('Hello Ben');
    });
  });

  describe('key-only mode fallback (without Babel transformation)', () => {
    it('returns id and warns when not transformed by Babel', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function TestComponent() {
        const t = useT();
        return <div data-testid="result">{t({ id: 'greeting' })}</div>;
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      // Returns the id as fallback
      expect(screen.getByTestId('result').textContent).toBe('greeting');

      // Warns that Babel didn't transform
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          't({ id: "greeting" }) was not transformed by Babel',
        ),
      );

      warnSpy.mockRestore();
    });

    it('returns id for complex keys when not transformed', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function TestComponent() {
        const t = useT();
        return <div data-testid="result">{t({ id: 'some.nested.key' })}</div>;
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('some.nested.key');

      warnSpy.mockRestore();
    });
  });

  describe('Babel-transformed behavior (simulated)', () => {
    it('uses inlined translations when Babel has transformed', () => {
      function TestComponent() {
        const t = useT();
        // Simulate what Babel produces:
        // t('Hello', { __m: { en: 'Hello', es: 'Hola' } })
        return (
          <div data-testid="result">
            {t('Hello', {
              __m: { en: 'Hello', es: 'Hola' },
            } as unknown as Record<string, unknown>)}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hola');
    });

    it('uses inlined translations with values', () => {
      function TestComponent() {
        const t = useT();
        // Simulate Babel-transformed call with values in 3rd arg:
        // t('Hello {name}', { __m: { en: '...', es: '...' } }, { name: 'Ben' })
        return (
          <div data-testid="result">
            {t(
              'Hello {name}',
              {
                __m: { en: 'Hello {name}', es: 'Hola {name}' },
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

    it('uses function messages for plurals', () => {
      function TestComponent() {
        const t = useT();
        // Simulate Babel-transformed call with function message:
        return (
          <div data-testid="result">
            {t(
              '{count} items',
              {
                __m: {
                  en: (args: { count: number }) =>
                    args.count === 1 ? '1 item' : `${args.count} items`,
                  es: (args: { count: number }) =>
                    args.count === 1 ? '1 artículo' : `${args.count} artículos`,
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

    it('falls back to first locale if current locale not found', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">
            {t('Hello', {
              __m: { en: 'Hello', es: 'Hola' },
            } as unknown as Record<string, unknown>)}
          </div>
        );
      }

      render(
        <IdiomaProvider locale="fr">
          <TestComponent />
        </IdiomaProvider>,
      );

      // Falls back to first available (en)
      expect(screen.getByTestId('result').textContent).toBe('Hello');
    });
  });

  describe('locale changes', () => {
    it('updates when locale changes', () => {
      function TestComponent() {
        const t = useT();
        // Using Babel-transformed format to test locale switching
        return (
          <div data-testid="result">
            {t('Hello', {
              __m: { en: 'Hello', es: 'Hola' },
            } as unknown as Record<string, unknown>)}
          </div>
        );
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
  });

  describe('object form fallback (without Babel transformation)', () => {
    it('returns id as fallback when no source', () => {
      function TestComponent() {
        const t = useT();
        return <div data-testid="result">{t({ id: 'greeting' })}</div>;
      }

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('greeting');
      vi.restoreAllMocks();
    });

    it('returns source as fallback when provided', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">
            {t({ id: 'greeting', source: 'Hello!' })}
          </div>
        );
      }

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello!');
      vi.restoreAllMocks();
    });

    it('interpolates values into source fallback', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">
            {t({
              id: 'greeting',
              source: 'Hello {name}!',
              values: { name: 'Ben' },
            })}
          </div>
        );
      }

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hello Ben!');
      vi.restoreAllMocks();
    });
  });

  describe('error handling', () => {
    it('throws when used outside provider', () => {
      function TestComponent() {
        const t = useT();
        return <div>{t({ id: 'greeting' })}</div>;
      }

      expect(() => {
        render(<TestComponent />);
      }).toThrow('[idioma] useT must be used within an IdiomaProvider');
    });
  });
});
