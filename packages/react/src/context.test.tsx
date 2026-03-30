import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createIdiomiProvider, createUseLocale } from './context';

describe('createIdiomiProvider', () => {
  it('creates a provider that renders children', () => {
    const IdiomiProvider = createIdiomiProvider();

    render(
      <IdiomiProvider locale="en">
        <div>Hello World</div>
      </IdiomiProvider>,
    );

    expect(screen.getByText('Hello World')).toBeDefined();
  });

  it('provides locale value to context', () => {
    const IdiomiProvider = createIdiomiProvider();
    const useLocale = createUseLocale();

    function TestComponent() {
      const locale = useLocale();
      return <div data-testid="locale">{locale}</div>;
    }

    render(
      <IdiomiProvider locale="es">
        <TestComponent />
      </IdiomiProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('propagates locale changes to children', () => {
    const IdiomiProvider = createIdiomiProvider();
    const useLocale = createUseLocale();

    function TestComponent() {
      const locale = useLocale();
      return <div data-testid="locale">{locale}</div>;
    }

    const { rerender } = render(
      <IdiomiProvider locale="en">
        <TestComponent />
      </IdiomiProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('en');

    rerender(
      <IdiomiProvider locale="de">
        <TestComponent />
      </IdiomiProvider>,
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
    const IdiomiProvider = createIdiomiProvider();
    const useLocale = createUseLocale();

    function TestComponent() {
      const locale = useLocale();
      return <div data-testid="locale">{locale}</div>;
    }

    render(
      <IdiomiProvider locale="fr">
        <TestComponent />
      </IdiomiProvider>,
    );

    expect(screen.getByTestId('locale').textContent).toBe('fr');
  });
});
