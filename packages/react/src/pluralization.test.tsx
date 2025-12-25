import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createIdiomaProvider } from './context';
import { _syncLocale, Plural, plural } from './pluralization';

const IdiomaProvider = createIdiomaProvider();

describe('Plural', () => {
  it('renders the "other" form with value substituted (dev mode)', () => {
    render(
      <div data-testid="result">
        <Plural value={5} one="# item" other="# items" />
      </div>,
    );

    expect(screen.getByTestId('result').textContent).toBe('5 items');
  });

  it('renders the "one" form when value is 1', () => {
    render(
      <div data-testid="result">
        <Plural value={1} one="# item" other="# items" />
      </div>,
    );

    // In dev mode, we use simple English rules
    expect(screen.getByTestId('result').textContent).toBe('1 item');
  });

  it('handles zero value', () => {
    render(
      <div data-testid="result">
        <Plural value={0} zero="no items" one="# item" other="# items" />
      </div>,
    );

    // zero form should be used when value is 0 and zero is provided
    expect(screen.getByTestId('result').textContent).toBe('no items');
  });

  it('falls back to other when zero not provided', () => {
    render(
      <div data-testid="result">
        <Plural value={0} one="# item" other="# items" />
      </div>,
    );

    expect(screen.getByTestId('result').textContent).toBe('0 items');
  });
});

describe('plural', () => {
  it('returns the "other" form with value substituted', () => {
    const result = plural(5, { one: '# item', other: '# items' });
    expect(result).toBe('5 items');
  });

  it('returns the "one" form when value is 1', () => {
    const result = plural(1, { one: '# item', other: '# items' });
    expect(result).toBe('1 item');
  });

  it('handles zero form', () => {
    const result = plural(0, {
      zero: 'no items',
      one: '# item',
      other: '# items',
    });
    expect(result).toBe('no items');
  });

  it('falls back to other when zero not provided', () => {
    const result = plural(0, { one: '# item', other: '# items' });
    expect(result).toBe('0 items');
  });
});

describe('Plural with CLDR rules', () => {
  it('handles Russian plural rules (few) for values 2-4', () => {
    // Russian: 2, 3, 4 use "few" form
    render(
      <IdiomaProvider locale="ru">
        <div data-testid="result">
          <Plural
            value={2}
            one="# сообщение"
            few="# сообщения"
            many="# сообщений"
            other="# сообщения"
          />
        </div>
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('2 сообщения');
  });

  it('handles Russian plural rules (many) for values 5-20', () => {
    // Russian: 5-20 use "many" form
    render(
      <IdiomaProvider locale="ru">
        <div data-testid="result">
          <Plural
            value={5}
            one="# сообщение"
            few="# сообщения"
            many="# сообщений"
            other="# сообщения"
          />
        </div>
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('5 сообщений');
  });

  it('handles Russian plural rules (one) for value 21', () => {
    // Russian: 21, 31, etc. use "one" form
    render(
      <IdiomaProvider locale="ru">
        <div data-testid="result">
          <Plural
            value={21}
            one="# сообщение"
            few="# сообщения"
            many="# сообщений"
            other="# сообщения"
          />
        </div>
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('21 сообщение');
  });

  it('handles Arabic plural rules (two) for value 2', () => {
    // Arabic: 2 uses "two" form
    render(
      <IdiomaProvider locale="ar">
        <div data-testid="result">
          <Plural
            value={2}
            zero="لا رسائل"
            one="رسالة واحدة"
            two="رسالتان"
            few="# رسائل"
            many="# رسالة"
            other="# رسالة"
          />
        </div>
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('رسالتان');
  });

  it('falls back to other when category form not provided', () => {
    // Even with Russian locale, if 'few' is missing, should use 'other'
    render(
      <IdiomaProvider locale="ru">
        <div data-testid="result">
          <Plural value={2} one="# item" other="# items" />
        </div>
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('2 items');
  });

  it('uses English rules when no context', () => {
    // Without IdiomaProvider, should default to English rules
    render(
      <div data-testid="result">
        <Plural value={5} one="# item" other="# items" />
      </div>,
    );
    expect(screen.getByTestId('result').textContent).toBe('5 items');
  });
});

describe('plural function with CLDR rules', () => {
  beforeEach(() => {
    // Reset synced locale before each test
    _syncLocale('en');
  });

  it('uses synced locale when none provided', () => {
    _syncLocale('ru');
    const result = plural(5, {
      one: '# сообщение',
      few: '# сообщения',
      many: '# сообщений',
      other: '# сообщения',
    });
    expect(result).toBe('5 сообщений');
  });

  it('uses explicit locale over synced locale', () => {
    _syncLocale('en');
    const result = plural(
      2,
      {
        one: '# item',
        few: '# items (few)',
        many: '# items (many)',
        other: '# items',
      },
      'ru',
    );
    // Russian: 2 uses 'few' form
    expect(result).toBe('2 items (few)');
  });

  it('handles Russian 21 correctly with synced locale', () => {
    _syncLocale('ru');
    const result = plural(21, {
      one: '# сообщение',
      few: '# сообщения',
      many: '# сообщений',
      other: '# сообщения',
    });
    expect(result).toBe('21 сообщение');
  });

  it('defaults to English rules when no locale synced', () => {
    // _syncLocale('en') already called in beforeEach
    const result = plural(5, { one: '# item', other: '# items' });
    expect(result).toBe('5 items');
  });
});
