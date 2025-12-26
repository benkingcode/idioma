import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetNonInteractive, setNonInteractive } from './env.js';
import { createProgressBar, SimpleProgressBar } from './progress.js';

describe('SimpleProgressBar', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs start message with total', () => {
    const bar = new SimpleProgressBar({ label: 'Translating' });
    bar.start(100, 0);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Translating'),
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('0/100'));
  });

  it('logs update with current value and percentage', () => {
    const bar = new SimpleProgressBar({ label: 'Processing' });
    bar.start(100, 0);
    consoleSpy.mockClear();

    bar.update(50);

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('50/100'));
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('50%'));
  });

  it('includes payload in update message', () => {
    const bar = new SimpleProgressBar({ label: 'Translating' });
    bar.start(100, 0);
    consoleSpy.mockClear();

    bar.update(25, { locale: 'es' });

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('es'));
  });

  it('logs completion message on stop', () => {
    const bar = new SimpleProgressBar({ label: 'Done' });
    bar.start(50, 0);
    bar.update(50);
    consoleSpy.mockClear();

    bar.stop();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Done'));
  });

  it('uses default label if none provided', () => {
    const bar = new SimpleProgressBar();
    bar.start(10, 0);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Progress'),
    );
  });
});

describe('createProgressBar', () => {
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

  it('returns SimpleProgressBar when non-interactive is forced', () => {
    setNonInteractive(true);
    const bar = createProgressBar();
    expect(bar).toBeInstanceOf(SimpleProgressBar);
  });

  it('returns SimpleProgressBar when not a TTY', () => {
    Object.defineProperty(process.stderr, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    const bar = createProgressBar();
    expect(bar).toBeInstanceOf(SimpleProgressBar);
  });
});
