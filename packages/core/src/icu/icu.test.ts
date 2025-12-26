import { describe, expect, it } from 'vitest';
import { _syncLocale, plural, select, selectOrdinal } from './index';

describe('plural()', () => {
  it('returns the correct form for count 1', () => {
    _syncLocale('en');
    expect(plural(1, { one: '# item', other: '# items' })).toBe('1 item');
  });

  it('returns the correct form for count > 1', () => {
    _syncLocale('en');
    expect(plural(5, { one: '# item', other: '# items' })).toBe('5 items');
  });

  it('handles zero form explicitly', () => {
    _syncLocale('en');
    expect(
      plural(0, { zero: 'no items', one: '# item', other: '# items' }),
    ).toBe('no items');
  });

  it('falls back to other when no matching form', () => {
    _syncLocale('en');
    expect(plural(0, { one: '# item', other: '# items' })).toBe('0 items');
  });

  it('replaces # placeholder with value', () => {
    _syncLocale('en');
    expect(
      plural(42, { one: 'You have # message', other: 'You have # messages' }),
    ).toBe('You have 42 messages');
  });

  it('respects locale parameter', () => {
    // Arabic uses different plural forms
    expect(plural(0, { zero: 'صفر', one: 'واحد', other: 'كثير' }, 'ar')).toBe(
      'صفر',
    );
  });
});

describe('selectOrdinal()', () => {
  it('returns "one" form for 1, 21, 31 (ends in 1, not 11)', () => {
    _syncLocale('en');
    expect(
      selectOrdinal(1, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('1st');
    expect(
      selectOrdinal(21, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('21st');
    expect(
      selectOrdinal(31, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('31st');
  });

  it('returns "two" form for 2, 22, 32 (ends in 2, not 12)', () => {
    _syncLocale('en');
    expect(
      selectOrdinal(2, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('2nd');
    expect(
      selectOrdinal(22, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('22nd');
  });

  it('returns "few" form for 3, 23, 33 (ends in 3, not 13)', () => {
    _syncLocale('en');
    expect(
      selectOrdinal(3, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('3rd');
    expect(
      selectOrdinal(23, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('23rd');
  });

  it('returns "other" form for 4, 5, 11, 12, 13, etc.', () => {
    _syncLocale('en');
    expect(
      selectOrdinal(4, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('4th');
    expect(
      selectOrdinal(5, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('5th');
    expect(
      selectOrdinal(11, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('11th');
    expect(
      selectOrdinal(12, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('12th');
    expect(
      selectOrdinal(13, { one: '#st', two: '#nd', few: '#rd', other: '#th' }),
    ).toBe('13th');
  });

  it('falls back to other when form not provided', () => {
    _syncLocale('en');
    expect(selectOrdinal(1, { other: '#th' })).toBe('1th');
  });

  it('replaces # placeholder with value', () => {
    _syncLocale('en');
    expect(
      selectOrdinal(1, { one: 'You placed #st', other: 'You placed #th' }),
    ).toBe('You placed 1st');
  });
});

describe('select()', () => {
  it('returns exact match for known value', () => {
    expect(select('male', { male: 'He', female: 'She', other: 'They' })).toBe(
      'He',
    );
    expect(select('female', { male: 'He', female: 'She', other: 'They' })).toBe(
      'She',
    );
  });

  it('returns other for unknown value', () => {
    expect(
      select('unknown', { male: 'He', female: 'She', other: 'They' }),
    ).toBe('They');
    expect(
      select('nonbinary', { male: 'He', female: 'She', other: 'They' }),
    ).toBe('They');
  });

  it('handles many options', () => {
    const forms = {
      pending: 'Waiting',
      approved: 'Accepted',
      rejected: 'Denied',
      cancelled: 'Cancelled',
      other: 'Unknown',
    };

    expect(select('pending', forms)).toBe('Waiting');
    expect(select('approved', forms)).toBe('Accepted');
    expect(select('rejected', forms)).toBe('Denied');
    expect(select('cancelled', forms)).toBe('Cancelled');
    expect(select('anything-else', forms)).toBe('Unknown');
  });

  it('always falls back to other', () => {
    expect(select('foo', { other: 'default' })).toBe('default');
  });
});

describe('plural function with CLDR rules', () => {
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
    _syncLocale('en');
    const result = plural(5, { one: '# item', other: '# items' });
    expect(result).toBe('5 items');
  });
});
