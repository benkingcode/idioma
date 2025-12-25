import { describe, expect, it } from 'vitest';
import { generateKey } from './generator';

describe('generateKey', () => {
  it('generates the same key for the same input', () => {
    const key1 = generateKey('Hello, world!');
    const key2 = generateKey('Hello, world!');
    expect(key1).toBe(key2);
  });

  it('generates different keys for different inputs', () => {
    const key1 = generateKey('Hello, world!');
    const key2 = generateKey('Goodbye, world!');
    expect(key1).not.toBe(key2);
  });

  it('generates different keys when context differs', () => {
    const key1 = generateKey('Submit', 'button');
    const key2 = generateKey('Submit', 'form');
    expect(key1).not.toBe(key2);
  });

  it('generates a different key with vs without context', () => {
    const key1 = generateKey('Submit');
    const key2 = generateKey('Submit', 'button');
    expect(key1).not.toBe(key2);
  });

  it('generates a key of expected length (8 characters)', () => {
    const key = generateKey('Hello, world!');
    expect(key.length).toBe(8);
  });

  it('generates a key with only alphanumeric characters (base62)', () => {
    const key = generateKey('Hello, world!');
    expect(key).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('handles empty string', () => {
    const key = generateKey('');
    expect(key.length).toBe(8);
    expect(key).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('handles unicode characters', () => {
    const key = generateKey('こんにちは世界');
    expect(key.length).toBe(8);
    expect(key).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('handles long messages', () => {
    const longMessage = 'a'.repeat(10000);
    const key = generateKey(longMessage);
    expect(key.length).toBe(8);
    expect(key).toMatch(/^[0-9A-Za-z]+$/);
  });

  it('uses context separator correctly', () => {
    // Context is joined with \u0004 (ASCII end-of-transmission)
    // Ensure this produces consistent results
    const key = generateKey('Hello', 'ctx');
    expect(key.length).toBe(8);
    expect(key).toMatch(/^[0-9A-Za-z]+$/);
  });

  // Namespace support tests
  describe('with namespace', () => {
    it('generates different keys when namespace differs', () => {
      const key1 = generateKey('Submit', undefined, 'auth');
      const key2 = generateKey('Submit', undefined, 'forms');
      expect(key1).not.toBe(key2);
    });

    it('generates a different key with vs without namespace', () => {
      const key1 = generateKey('Submit');
      const key2 = generateKey('Submit', undefined, 'auth');
      expect(key1).not.toBe(key2);
    });

    it('generates different keys for namespace vs context with same value', () => {
      // Namespace and context should use different separators
      const keyWithContext = generateKey('Submit', 'auth');
      const keyWithNamespace = generateKey('Submit', undefined, 'auth');
      expect(keyWithContext).not.toBe(keyWithNamespace);
    });

    it('generates unique keys when both namespace and context are used', () => {
      const key1 = generateKey('Submit', 'button', 'auth');
      const key2 = generateKey('Submit', 'button', 'forms');
      const key3 = generateKey('Submit', 'link', 'auth');
      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it('is idempotent with namespace', () => {
      const key1 = generateKey('Hello', 'ctx', 'ns');
      const key2 = generateKey('Hello', 'ctx', 'ns');
      expect(key1).toBe(key2);
    });

    it('generates valid base62 key with namespace', () => {
      const key = generateKey('Hello', undefined, 'myNamespace');
      expect(key.length).toBe(8);
      expect(key).toMatch(/^[0-9A-Za-z]+$/);
    });
  });
});
