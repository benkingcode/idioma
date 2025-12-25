import { beforeEach, describe, expect, it } from 'vitest';
import { _syncLocale, plural } from './pluralization';

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
