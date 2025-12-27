import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedExtractor } from './debounce';

describe('createDebouncedExtractor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls extract function after delay', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');

    // Should not be called immediately
    expect(extractFn).not.toHaveBeenCalled();

    // Advance timer past delay
    await vi.advanceTimersByTimeAsync(200);

    expect(extractFn).toHaveBeenCalledWith(['src/App.tsx']);
  });

  it('accumulates multiple files before calling extract', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');
    extractor.add('src/Header.tsx');
    extractor.add('src/Footer.tsx');

    await vi.advanceTimersByTimeAsync(200);

    expect(extractFn).toHaveBeenCalledTimes(1);
    expect(extractFn).toHaveBeenCalledWith([
      'src/App.tsx',
      'src/Header.tsx',
      'src/Footer.tsx',
    ]);
  });

  it('resets delay when new file is added', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');

    // Advance 100ms (half the delay)
    await vi.advanceTimersByTimeAsync(100);
    expect(extractFn).not.toHaveBeenCalled();

    // Add another file - should reset the timer
    extractor.add('src/Header.tsx');

    // Advance another 100ms (would have been 200ms total from first add)
    await vi.advanceTimersByTimeAsync(100);
    expect(extractFn).not.toHaveBeenCalled();

    // Advance final 100ms (200ms from second add)
    await vi.advanceTimersByTimeAsync(100);
    expect(extractFn).toHaveBeenCalledWith(['src/App.tsx', 'src/Header.tsx']);
  });

  it('deduplicates repeated file paths', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');
    extractor.add('src/App.tsx');
    extractor.add('src/App.tsx');

    await vi.advanceTimersByTimeAsync(200);

    expect(extractFn).toHaveBeenCalledWith(['src/App.tsx']);
  });

  it('calls onComplete after successful extraction', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const onComplete = vi.fn();
    const extractor = createDebouncedExtractor(extractFn, {
      delay: 200,
      onComplete,
    });

    extractor.add('src/App.tsx');
    await vi.advanceTimersByTimeAsync(200);

    // Wait for async completion
    await vi.runAllTimersAsync();

    expect(onComplete).toHaveBeenCalledWith({ files: ['src/App.tsx'] });
  });

  it('calls onError when extraction fails', async () => {
    const error = new Error('Extraction failed');
    const extractFn = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    const extractor = createDebouncedExtractor(extractFn, {
      delay: 200,
      onError,
    });

    extractor.add('src/App.tsx');
    await vi.advanceTimersByTimeAsync(200);

    // Wait for async completion
    await vi.runAllTimersAsync();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('flush() triggers immediate extraction', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');
    extractor.add('src/Header.tsx');

    // Flush without waiting for timer
    await extractor.flush();

    expect(extractFn).toHaveBeenCalledWith(['src/App.tsx', 'src/Header.tsx']);
  });

  it('flush() does nothing when no pending files', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    await extractor.flush();

    expect(extractFn).not.toHaveBeenCalled();
  });

  it('cancel() clears pending files', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');
    extractor.cancel();

    await vi.advanceTimersByTimeAsync(200);

    expect(extractFn).not.toHaveBeenCalled();
  });

  it('can queue new files after flush', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn, { delay: 200 });

    extractor.add('src/App.tsx');
    await extractor.flush();

    expect(extractFn).toHaveBeenCalledTimes(1);

    extractor.add('src/Header.tsx');
    await vi.advanceTimersByTimeAsync(200);

    expect(extractFn).toHaveBeenCalledTimes(2);
    expect(extractFn).toHaveBeenLastCalledWith(['src/Header.tsx']);
  });

  it('uses default delay of 200ms', async () => {
    const extractFn = vi.fn().mockResolvedValue(undefined);
    const extractor = createDebouncedExtractor(extractFn);

    extractor.add('src/App.tsx');

    await vi.advanceTimersByTimeAsync(199);
    expect(extractFn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(extractFn).toHaveBeenCalled();
  });
});
