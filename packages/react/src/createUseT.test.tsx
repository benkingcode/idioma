import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createIdiomaProvider } from './context';
import { createUseT } from './createUseT';
import { generateKey } from './server/generateKey';

const IdiomaProvider = createIdiomaProvider();

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

const useT = createUseT(translations);

describe('createUseT', () => {
  describe('source text mode', () => {
    it('translates source text for given locale', () => {
      function TestComponent() {
        const t = useT();
        return <div data-testid="result">{t('Hello world!')}</div>;
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('¡Hola mundo!');
    });

    it('returns source text if translation not found', () => {
      function TestComponent() {
        const t = useT();
        return <div data-testid="result">{t('Unknown message')}</div>;
      }

      render(
        <IdiomaProvider locale="en">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Unknown message');
    });

    it('interpolates values in source text mode', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">{t('Hello {name}', { name: 'Ben' })}</div>
        );
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hola Ben');
    });

    it('uses context to generate different key', () => {
      function TestComponent() {
        const t = useT();
        return (
          <div data-testid="result">{t('Submit', { context: 'button' })}</div>
        );
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Enviar');
    });
  });

  describe('key-only mode', () => {
    it('looks up by explicit id', () => {
      function TestComponent() {
        const t = useT();
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
        const t = useT();
        return <div data-testid="result">{t({ id: 'greeting' })}</div>;
      }

      render(
        <IdiomaProvider locale="es">
          <TestComponent />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('result').textContent).toBe('Hola');
    });

    it('interpolates values with id lookup', () => {
      function TestComponent() {
        const t = useT();
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
        const t = useT();
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
        const t = useT();
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
        const t = useT();
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
      const t = useT();
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
