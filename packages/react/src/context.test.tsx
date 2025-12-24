import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createIdiomaProvider, createUseLocale } from './context';

describe('createIdiomaProvider', () => {
  it('creates a provider that renders children', () => {
    const IdiomaProvider = createIdiomaProvider();

    render(
      <IdiomaProvider locale="en">
        <div>Hello World</div>
      </IdiomaProvider>,
    );

    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('provides locale value to context', () => {
    const IdiomaProvider = createIdiomaProvider();
    const useLocale = createUseLocale();

    function TestComponent() {
      const locale = useLocale();
      return <div data-testid="locale">{locale}</div>;
    }

    render(
      <IdiomaProvider locale="es">
        <TestComponent />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('propagates locale changes to children', () => {
    const IdiomaProvider = createIdiomaProvider();
    const useLocale = createUseLocale();

    function TestComponent() {
      const locale = useLocale();
      return <div data-testid="locale">{locale}</div>;
    }

    const { rerender } = render(
      <IdiomaProvider locale="en">
        <TestComponent />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');

    rerender(
      <IdiomaProvider locale="de">
        <TestComponent />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('de');
  });
});

describe('createUseLocale', () => {
  it('throws when used outside provider', () => {
    const useLocale = createUseLocale();

    function TestComponent() {
      useLocale();
      return null;
    }

    // React will throw when hook is used outside provider
    expect(() => {
      render(<TestComponent />);
    }).toThrow();
  });

  it('returns the current locale', () => {
    const IdiomaProvider = createIdiomaProvider();
    const useLocale = createUseLocale();

    function TestComponent() {
      const locale = useLocale();
      return <div data-testid="locale">{locale}</div>;
    }

    render(
      <IdiomaProvider locale="fr">
        <TestComponent />
      </IdiomaProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('fr');
  });
});
