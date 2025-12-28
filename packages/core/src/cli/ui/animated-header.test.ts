import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAnimatedHeader,
  InteractiveAnimatedHeader,
  SimpleAnimatedHeader,
} from './animated-header.js';
import { resetNonInteractive, setNonInteractive } from './env.js';

describe('SimpleAnimatedHeader', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('prints static header line on start', () => {
    const header = new SimpleAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
      model: 'claude-sonnet-4',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'idioma translate | Auto context: on | Model: claude-sonnet-4 (anthropic)',
    );
  });

  it('handles auto context off', () => {
    const header = new SimpleAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: false,
      provider: 'openai',
      model: 'gpt-4o',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'idioma translate | Auto context: off | Model: gpt-4o (openai)',
    );
  });

  it('handles missing model gracefully', () => {
    const header = new SimpleAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: false,
      provider: 'openai',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'idioma translate | Auto context: off | Model: openai',
    );
  });

  it('prints blank line after header', () => {
    const header = new SimpleAnimatedHeader();
    header.start({
      title: 'test',
      autoContext: true,
      provider: 'anthropic',
    });

    // Second call should be empty string for blank line
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenNthCalledWith(2, '');
  });

  it('setStatus prints the status text', () => {
    const header = new SimpleAnimatedHeader();
    header.setStatus('Loading...');

    expect(consoleSpy).toHaveBeenCalledWith('Loading...');
  });

  it('setProgress prints progress in text format', () => {
    const header = new SimpleAnimatedHeader();
    header.setProgress('Translating', 5, 10);

    expect(consoleSpy).toHaveBeenCalledWith('Translating: 5/10 (50%)');
  });

  it('log prints the log text', () => {
    const header = new SimpleAnimatedHeader();
    header.log('✓ Done!');

    expect(consoleSpy).toHaveBeenCalledWith('✓ Done!');
  });

  it('stop is a no-op', () => {
    const header = new SimpleAnimatedHeader();
    header.stop(); // Should not throw
  });
});

describe('InteractiveAnimatedHeader', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    vi.useRealTimers();
  });

  it('hides cursor on start', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    expect(stdoutSpy).toHaveBeenCalledWith('\x1b[?25l');
    header.stop();
  });

  it('shows cursor on stop', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });
    header.stop();

    expect(stdoutSpy).toHaveBeenCalledWith('\x1b[?25h');
  });

  it('prints initial frame on start', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    // Find call that contains the title (part of rendered frame)
    const calls = stdoutSpy.mock.calls.map((c) => c[0]);
    const hasTitle = calls.some(
      (call) => typeof call === 'string' && call.includes('idioma translate'),
    );
    expect(hasTitle).toBe(true);

    header.stop();
  });

  it('advances frames on interval', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    const initialCallCount = stdoutSpy.mock.calls.length;

    // Advance timer by one animation frame (150ms)
    vi.advanceTimersByTime(150);

    expect(stdoutSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
    header.stop();
  });

  it('clears interval on stop', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    header.stop();
    const callCountAfterStop = stdoutSpy.mock.calls.length;

    // Advance time - should not trigger more animation frames
    vi.advanceTimersByTime(500);

    // Call count should not increase significantly (only final draw + cursor show)
    expect(stdoutSpy.mock.calls.length).toBe(callCountAfterStop);
  });

  it('stop is safe to call multiple times', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });
    header.stop();
    header.stop(); // Should not throw
    header.stop();
  });

  it('setStatus updates the content area', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    header.setStatus('Loading...');

    // Advance to trigger a redraw
    vi.advanceTimersByTime(150);

    const calls = stdoutSpy.mock.calls.map((c) => c[0]);
    const hasStatus = calls.some(
      (call) => typeof call === 'string' && call.includes('Loading...'),
    );
    expect(hasStatus).toBe(true);

    header.stop();
  });

  it('setProgress updates the progress bar', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    header.setProgress('Translating', 5, 10);

    // Advance to trigger a redraw
    vi.advanceTimersByTime(150);

    const calls = stdoutSpy.mock.calls.map((c) => c[0]);
    const hasProgress = calls.some(
      (call) => typeof call === 'string' && call.includes('5/10'),
    );
    expect(hasProgress).toBe(true);

    header.stop();
  });

  it('log adds to the log lines', () => {
    const header = new InteractiveAnimatedHeader();
    header.start({
      title: 'idioma translate',
      autoContext: true,
      provider: 'anthropic',
    });

    header.log('✓ Done!');

    // Advance to trigger a redraw
    vi.advanceTimersByTime(150);

    const calls = stdoutSpy.mock.calls.map((c) => c[0]);
    const hasLog = calls.some(
      (call) => typeof call === 'string' && call.includes('✓ Done!'),
    );
    expect(hasLog).toBe(true);

    header.stop();
  });
});

describe('createAnimatedHeader', () => {
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

  it('returns SimpleAnimatedHeader when non-interactive is forced', () => {
    setNonInteractive(true);
    const header = createAnimatedHeader();
    expect(header).toBeInstanceOf(SimpleAnimatedHeader);
  });

  it('returns SimpleAnimatedHeader when not a TTY', () => {
    Object.defineProperty(process.stderr, 'isTTY', {
      value: false,
      writable: true,
      configurable: true,
    });
    const header = createAnimatedHeader();
    expect(header).toBeInstanceOf(SimpleAnimatedHeader);
  });
});
