import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createIdiomaProvider } from './context';
import { createTrans } from './createTrans';

const IdiomaProvider = createIdiomaProvider();
const Trans = createTrans();

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

  describe('key-only mode fallback (without Babel transformation)', () => {
    it('returns id and warns when not transformed by Babel', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <IdiomaProvider locale="en">
          <Trans id="greeting" />
        </IdiomaProvider>,
      );

      // Returns the id as fallback
      expect(screen.getByText('greeting')).toBeDefined();

      // Warns that Babel didn't transform
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Trans with id="greeting" was not transformed by Babel',
        ),
      );

      warnSpy.mockRestore();
    });

    it('returns id for any key when Babel has not transformed', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <IdiomaProvider locale="es">
          <Trans id="some.complex.key" />
        </IdiomaProvider>,
      );

      expect(screen.getByText('some.complex.key')).toBeDefined();

      warnSpy.mockRestore();
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
