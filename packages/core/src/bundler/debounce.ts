/**
 * Interface for the debounced extractor utility.
 * Accumulates file paths and calls the extract function after a delay.
 */
export interface DebouncedExtractor {
  /** Queue a file for extraction */
  add(filePath: string): void;
  /** Force immediate processing of pending files */
  flush(): Promise<void>;
  /** Cancel pending extraction */
  cancel(): void;
}

/**
 * Options for creating a debounced extractor
 */
export interface DebouncedExtractorOptions {
  /** Debounce delay in ms (default: 200) */
  delay?: number;
  /** Called when extraction completes successfully */
  onComplete?: (result: { files: string[] }) => void;
  /** Called when extraction fails */
  onError?: (error: Error) => void;
}

/**
 * Creates a debounced extractor that accumulates file paths and calls
 * the extract function after a delay of inactivity.
 *
 * This helps handle rapid file saves (e.g., save-on-keystroke) by coalescing
 * multiple changes into a single extraction pass.
 *
 * @param extractFn - Function to call with accumulated file paths
 * @param options - Configuration options
 * @returns DebouncedExtractor interface
 */
export function createDebouncedExtractor(
  extractFn: (files: string[]) => Promise<void>,
  options: DebouncedExtractorOptions = {},
): DebouncedExtractor {
  const { delay = 200, onComplete, onError } = options;

  let pendingFiles = new Set<string>();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let processingPromise: Promise<void> | null = null;

  const process = async () => {
    if (pendingFiles.size === 0) {
      return;
    }

    const files = [...pendingFiles];
    pendingFiles = new Set();
    timeoutId = null;

    try {
      await extractFn(files);
      onComplete?.({ files });
    } catch (error) {
      onError?.(error as Error);
    }
  };

  return {
    add(filePath: string) {
      pendingFiles.add(filePath);

      // Reset timer on each add
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        processingPromise = process();
      }, delay);
    },

    async flush() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      await process();

      if (processingPromise) {
        await processingPromise;
      }
    },

    cancel() {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingFiles.clear();
    },
  };
}
