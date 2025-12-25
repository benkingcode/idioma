import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createIdiomaProvider } from './context';
import { createTrans } from './createTrans';

const IdiomaProvider = createIdiomaProvider();

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
  'legal.links': {
    en: 'Read our <0>terms</0> and <1>privacy</1>',
    es: 'Lee nuestros <0>términos</0> y <1>privacidad</1>',
  },
  'cart.summary': {
    en: 'You have {count} <0>items</0> in your cart',
    es: 'Tienes {count} <0>artículos</0> en tu carrito',
  },
};

const Trans = createTrans(translations);

describe('createTrans', () => {
  describe('inline mode (with children)', () => {
    it('renders children directly', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans>Hello World</Trans>
        </IdiomaProvider>,
      );

      expect(screen.getByText('Hello World')).toBeDefined();
    });

    it('renders JSX children', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans>
            Hello <strong data-testid="bold">World</strong>
          </Trans>
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('bold').textContent).toBe('World');
    });
  });

  describe('key-only mode (with id)', () => {
    it('looks up translation by id', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans id="greeting" />
        </IdiomaProvider>,
      );

      expect(screen.getByText('Hello')).toBeDefined();
    });

    it('switches locale dynamically', () => {
      const { rerender } = render(
        <IdiomaProvider locale="en">
          <Trans id="greeting" />
        </IdiomaProvider>,
      );

      expect(screen.getByText('Hello')).toBeDefined();

      rerender(
        <IdiomaProvider locale="es">
          <Trans id="greeting" />
        </IdiomaProvider>,
      );

      expect(screen.getByText('Hola')).toBeDefined();
    });

    it('interpolates values', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans id="greeting.name" values={{ name: 'Ben' }} />
        </IdiomaProvider>,
      );

      expect(screen.getByText('Hello Ben!')).toBeDefined();
    });

    it('interpolates components', () => {
      const Terms = ({ children }: { children?: React.ReactNode }) => (
        <a data-testid="terms">{children}</a>
      );
      const Privacy = ({ children }: { children?: React.ReactNode }) => (
        <a data-testid="privacy">{children}</a>
      );

      render(
        <IdiomaProvider locale="en">
          <Trans id="legal.links" components={[Terms, Privacy]} />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('terms').textContent).toBe('terms');
      expect(screen.getByTestId('privacy').textContent).toBe('privacy');
    });

    it('interpolates both values and components', () => {
      const Link = ({ children }: { children?: React.ReactNode }) => (
        <a data-testid="link">{children}</a>
      );

      render(
        <IdiomaProvider locale="en">
          <Trans id="cart.summary" values={{ count: 3 }} components={[Link]} />
        </IdiomaProvider>,
      );

      expect(screen.getByTestId('link').textContent).toBe('items');
      expect(screen.getByText(/You have 3/)).toBeDefined();
    });

    it('handles function messages (compiled plurals)', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans id="items.count" values={{ count: 5 }} />
        </IdiomaProvider>,
      );

      expect(screen.getByText('5 items')).toBeDefined();
    });

    it('handles function messages with count of 1', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans id="items.count" values={{ count: 1 }} />
        </IdiomaProvider>,
      );

      expect(screen.getByText('1 item')).toBeDefined();
    });

    it('returns key if translation is missing', () => {
      render(
        <IdiomaProvider locale="en">
          <Trans id="nonexistent.key" />
        </IdiomaProvider>,
      );

      expect(screen.getByText('nonexistent.key')).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        render(<Trans id="greeting" />);
      }).toThrow('[idioma] Trans must be used within an IdiomaProvider');
    });
  });
});
