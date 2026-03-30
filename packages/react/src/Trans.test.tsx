import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createIdiomiProvider } from './context';
import { __Trans } from './Trans';

const IdiomiProvider = createIdiomiProvider();

describe('__Trans', () => {
  it('renders a simple string for the current locale', () => {
    render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello',
            es: 'Hola',
          }}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByText('Hello')).toBeDefined();
  });

  it('switches locale dynamically', () => {
    const { rerender } = render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello',
            es: 'Hola',
          }}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByText('Hello')).toBeDefined();

    rerender(
      <IdiomiProvider locale="es">
        <__Trans
          __t={{
            en: 'Hello',
            es: 'Hola',
          }}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByText('Hola')).toBeDefined();
  });

  it('interpolates values with __a prop', () => {
    render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello {name}!',
            es: 'Hola {name}!',
          }}
          __a={{ name: 'Ben' }}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByText('Hello Ben!')).toBeDefined();
  });

  it('interpolates components with __c prop', () => {
    const Bold = ({ children }: { children: React.ReactNode }) => (
      <strong data-testid="bold">{children}</strong>
    );

    render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello <0>world</0>!',
            es: 'Hola <0>mundo</0>!',
          }}
          __c={[Bold]}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByTestId('bold').textContent).toBe('world');
  });

  it('handles function messages (compiled plurals)', () => {
    render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: ({ count }: { count: number }) =>
              count === 1 ? '1 item' : `${count} items`,
            es: ({ count }: { count: number }) =>
              count === 1 ? '1 artículo' : `${count} artículos`,
          }}
          __a={{ count: 5 }}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByText('5 items')).toBeDefined();
  });

  it('handles function messages with count of 1', () => {
    render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: ({ count }: { count: number }) =>
              count === 1 ? '1 item' : `${count} items`,
            es: ({ count }: { count: number }) =>
              count === 1 ? '1 artículo' : `${count} artículos`,
          }}
          __a={{ count: 1 }}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByText('1 item')).toBeDefined();
  });

  it('handles both values and components together', () => {
    const Link = ({ children }: { children: React.ReactNode }) => (
      <a data-testid="link">{children}</a>
    );

    render(
      <IdiomiProvider locale="en">
        <__Trans
          __t={{
            en: 'Hello {name}, click <0>here</0>!',
            es: 'Hola {name}, haz clic <0>aquí</0>!',
          }}
          __a={{ name: 'Ben' }}
          __c={[Link]}
        />
      </IdiomiProvider>,
    );

    expect(screen.getByTestId('link').textContent).toBe('here');
    // The full text should contain "Hello Ben"
    expect(screen.getByText(/Hello Ben/)).toBeDefined();
  });

  describe('graceful fallback when __t is missing', () => {
    it('renders children as fallback when __t is undefined', () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <IdiomiProvider locale="en">
          <__Trans
            // @ts-expect-error - testing runtime behavior when Babel didn't transform
            __t={undefined}
            children="Hello world"
          />
        </IdiomiProvider>,
      );

      expect(screen.getByText('Hello world')).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Idiomi: Missing translations'),
      );

      consoleSpy.mockRestore();
    });

    it('does not log warning in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      render(
        <IdiomiProvider locale="en">
          <__Trans
            // @ts-expect-error - testing runtime behavior when Babel didn't transform
            __t={undefined}
            children="Hello world"
          />
        </IdiomiProvider>,
      );

      expect(screen.getByText('Hello world')).toBeDefined();
      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });
  });
});
