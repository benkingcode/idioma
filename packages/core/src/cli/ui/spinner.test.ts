import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetNonInteractive, setNonInteractive } from './env.js';
import { createSpinner, InteractiveSpinner, SimpleSpinner } from './spinner.js';

describe('SimpleSpinner', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs start message', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Loading...');

    expect(consoleSpy).toHaveBeenCalledWith('Loading...');
  });

  it('logs update message', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Initial');
    spinner.update('Updated');

    expect(consoleSpy).toHaveBeenCalledWith('Updated');
  });

  it('logs succeed message with checkmark', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Working');
    spinner.succeed('Done!');

    expect(consoleSpy).toHaveBeenCalledWith('✓ Done!');
  });

  it('logs succeed with original text if no message provided', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Working');
    spinner.succeed();

    expect(consoleSpy).toHaveBeenCalledWith('✓ Working');
  });

  it('logs fail message with X', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Working');
    spinner.fail('Failed!');

    expect(consoleSpy).toHaveBeenCalledWith('✗ Failed!');
  });

  it('logs fail with original text if no message provided', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Working');
    spinner.fail();

    expect(consoleSpy).toHaveBeenCalledWith('✗ Working');
  });

  it('stop does nothing (no-op for simple spinner)', () => {
    const spinner = new SimpleSpinner();
    spinner.start('Working');
    spinner.stop();
    // Should not throw
  });

  it('succeed works without prior start', () => {
    const spinner = new SimpleSpinner();
    spinner.succeed('Done!');

    expect(consoleSpy).toHaveBeenCalledWith('✓ Done!');
  });

  it('fail works without prior start', () => {
    const spinner = new SimpleSpinner();
    spinner.fail('Failed!');

    expect(consoleSpy).toHaveBeenCalledWith('✗ Failed!');
  });
});

describe('InteractiveSpinner', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('succeed prints fallback message when called without start', () => {
    const spinner = new InteractiveSpinner();
    spinner.succeed('Done without spinner!');

    expect(consoleSpy).toHaveBeenCalledWith('✓ Done without spinner!');
  });

  it('fail prints fallback message when called without start', () => {
    const spinner = new InteractiveSpinner();
    spinner.fail('Failed without spinner!');

    expect(consoleSpy).toHaveBeenCalledWith('✗ Failed without spinner!');
  });
});

describe('createSpinner', () => {
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

  it('returns SimpleSpinner when non-interactive is forced', () => {
    setNonInteractive(true);
    const spinner = createSpinner();
    expect(spinner).toBeInstanceOf(SimpleSpinner);
  });

  it('returns SimpleSpinner when not a TTY', () => {
    Object.defineProperty(process.stderr, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    const spinner = createSpinner();
    expect(spinner).toBeInstanceOf(SimpleSpinner);
  });
});
