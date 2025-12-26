import { isCI } from 'ci-info';

/**
 * Global state set by CLI when --non-interactive is passed.
 * This allows forcing non-interactive mode even in TTY environments.
 */
let forceNonInteractive = false;

/**
 * Set non-interactive mode. When true, all UI helpers will use
 * simple text output instead of spinners/progress bars.
 */
export function setNonInteractive(value: boolean): void {
  forceNonInteractive = value;
}

/**
 * Reset non-interactive state to default (false).
 * Useful for testing.
 */
export function resetNonInteractive(): void {
  forceNonInteractive = false;
}

/**
 * Check if the current environment supports interactive UI.
 *
 * Returns false if:
 * - --non-interactive flag was passed (setNonInteractive(true))
 * - Running in a CI environment (detected by ci-info)
 * - stderr is not a TTY (e.g., piped output)
 *
 * Returns true otherwise (interactive terminal).
 */
export function isInteractive(): boolean {
  if (forceNonInteractive) return false;
  if (isCI) return false;
  if (!process.stderr.isTTY) return false;
  return true;
}
