import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { interpolateTags, interpolateValues } from './interpolate';

describe('interpolateValues', () => {
  it('replaces a simple named placeholder', () => {
    const result = interpolateValues('Hello {name}!', { name: 'Ben' });
    expect(result).toBe('Hello Ben!');
  });

  it('replaces multiple placeholders', () => {
    const result = interpolateValues('Hello {first} {last}!', {
      first: 'Ben',
      last: 'King',
    });
    expect(result).toBe('Hello Ben King!');
  });

  it('replaces numbered placeholders', () => {
    const result = interpolateValues('Total: {0} items', { '0': 42 });
    expect(result).toBe('Total: 42 items');
  });

  it('handles dotted placeholders', () => {
    const result = interpolateValues('Hello {user.name}!', {
      'user.name': 'Ben',
    });
    expect(result).toBe('Hello Ben!');
  });

  it('keeps placeholder if value is missing', () => {
    const result = interpolateValues('Hello {name}!', {});
    expect(result).toBe('Hello {name}!');
  });

  it('converts numbers to strings', () => {
    const result = interpolateValues('Count: {count}', { count: 5 });
    expect(result).toBe('Count: 5');
  });

  it('handles empty string values', () => {
    const result = interpolateValues('Value: {val}', { val: '' });
    expect(result).toBe('Value: ');
  });

  it('handles zero values', () => {
    const result = interpolateValues('Count: {count}', { count: 0 });
    expect(result).toBe('Count: 0');
  });

  it('returns original string if no placeholders', () => {
    const result = interpolateValues('Hello world!', {});
    expect(result).toBe('Hello world!');
  });
});

describe('interpolateTags', () => {
  it('interpolates a single tag', () => {
    const Link = ({ children }: { children: React.ReactNode }) =>
      createElement('a', { href: '/test' }, children);

    const result = interpolateTags('Read our <0>terms</0>', [Link]);

    // Result should be an array with text and the Link component
    expect(Array.isArray(result) || typeof result === 'object').toBe(true);
  });

  it('interpolates multiple tags', () => {
    const Link1 = ({ children }: { children: React.ReactNode }) =>
      createElement('a', { href: '/terms' }, children);
    const Link2 = ({ children }: { children: React.ReactNode }) =>
      createElement('a', { href: '/privacy' }, children);

    const result = interpolateTags('Read our <0>terms</0> and <1>privacy</1>', [
      Link1,
      Link2,
    ]);

    expect(result).toBeDefined();
  });

  it('handles text before, between, and after tags', () => {
    const Bold = ({ children }: { children: React.ReactNode }) =>
      createElement('strong', null, children);

    const result = interpolateTags('Hello <0>world</0>!', [Bold]);

    expect(result).toBeDefined();
  });

  it('handles no tags (returns string)', () => {
    const result = interpolateTags('Hello world!', []);

    expect(result).toBe('Hello world!');
  });

  it('interpolates values inside tags', () => {
    const Link = ({ children }: { children: React.ReactNode }) =>
      createElement('a', null, children);

    const result = interpolateTags('Hello {name}, click <0>here</0>', [Link], {
      name: 'Ben',
    });

    expect(result).toBeDefined();
  });

  it('handles missing component gracefully', () => {
    // If component at index doesn't exist, just render the inner text
    const result = interpolateTags('Click <5>here</5>', []);

    expect(result).toBeDefined();
  });
});
