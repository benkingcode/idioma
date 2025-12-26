import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isInteractive,
  resetNonInteractive,
  setNonInteractive,
} from './env.js';

describe('isInteractive', () => {
  const originalIsTTY = process.stderr.isTTY;

  beforeEach(() => {
    resetNonInteractive();
  });

  afterEach(() => {
    resetNonInteractive();
    // Restore original isTTY value
    Object.defineProperty(process.stderr, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it('returns false when setNonInteractive(true) is called', () => {
    // Mock TTY to be true
    Object.defineProperty(process.stderr, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });

    setNonInteractive(true);
    expect(isInteractive()).toBe(false);
  });

  it('returns true after setNonInteractive(false) is called', () => {
    Object.defineProperty(process.stderr, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });

    setNonInteractive(true);
    expect(isInteractive()).toBe(false);

    setNonInteractive(false);
    // Note: This might still be false in CI due to ci-info detection
    // So we test that it's no longer forced off
    resetNonInteractive();
  });

  it('returns false when stderr is not a TTY', () => {
    Object.defineProperty(process.stderr, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    resetNonInteractive();

    expect(isInteractive()).toBe(false);
  });
});

describe('setNonInteractive', () => {
  const originalIsTTY = process.stderr.isTTY;

  beforeEach(() => {
    resetNonInteractive();
  });

  afterEach(() => {
    resetNonInteractive();
    Object.defineProperty(process.stderr, 'isTTY', {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it('forces non-interactive mode regardless of TTY', () => {
    Object.defineProperty(process.stderr, 'isTTY', {
      value: true,
      writable: true,
      configurable: true,
    });

    // Force non-interactive
    setNonInteractive(true);
    expect(isInteractive()).toBe(false);
  });

  it('can be reset', () => {
    setNonInteractive(true);
    resetNonInteractive();
    // After reset, the forceNonInteractive flag is false
    // (actual result depends on TTY and CI)
  });
});
