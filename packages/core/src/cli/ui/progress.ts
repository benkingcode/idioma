import chalk from 'chalk';
import { Presets, SingleBar } from 'cli-progress';
import { isInteractive } from './env.js';

/**
 * Options for creating a progress bar.
 */
export interface ProgressBarOptions {
  /** Label to show before the progress bar */
  label?: string;
}

/**
 * Interface for a progress bar that shows determinate progress.
 * Used for operations where we know the total count upfront.
 */
export interface ProgressBar {
  /** Start the progress bar with total and optional initial value */
  start(total: number, initial?: number): void;
  /** Update progress to a new value, with optional payload for display */
  update(value: number, payload?: Record<string, string>): void;
  /** Stop the progress bar */
  stop(): void;
}

/**
 * Interactive progress bar using cli-progress.
 * Shows animated progress bar in TTY environments.
 */
export class InteractiveProgressBar implements ProgressBar {
  private bar: SingleBar | null = null;
  private label: string;
  private total = 0;

  constructor(options?: ProgressBarOptions) {
    this.label = options?.label ?? 'Progress';
  }

  start(total: number, initial: number = 0): void {
    this.total = total;
    this.bar = new SingleBar(
      {
        format: `${this.label} ${chalk.cyan('{bar}')} {value}/{total} | {percentage}%{payload}`,
        barCompleteChar: '█',
        barIncompleteChar: '░',
        hideCursor: true,
        stream: process.stderr,
      },
      Presets.shades_classic,
    );
    this.bar.start(total, initial, { payload: '' });
  }

  update(value: number, payload?: Record<string, string>): void {
    if (this.bar) {
      const payloadStr = payload
        ? ' | ' +
          Object.entries(payload)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : '';
      this.bar.update(value, { payload: payloadStr });
    }
  }

  stop(): void {
    if (this.bar) {
      this.bar.stop();
      this.bar = null;
    }
  }
}

/**
 * Simple progress bar for CI/non-TTY environments.
 * Uses plain console.log with periodic updates.
 */
export class SimpleProgressBar implements ProgressBar {
  private label: string;
  private total = 0;
  private lastValue = 0;

  constructor(options?: ProgressBarOptions) {
    this.label = options?.label ?? 'Progress';
  }

  start(total: number, initial: number = 0): void {
    this.total = total;
    this.lastValue = initial;
    const percentage = total > 0 ? Math.round((initial / total) * 100) : 0;
    console.log(`${this.label}: ${initial}/${total} (${percentage}%)`);
  }

  update(value: number, payload?: Record<string, string>): void {
    this.lastValue = value;
    const percentage =
      this.total > 0 ? Math.round((value / this.total) * 100) : 0;
    const payloadStr = payload
      ? ' | ' +
        Object.entries(payload)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')
      : '';
    console.log(
      `${this.label}: ${value}/${this.total} (${percentage}%)${payloadStr}`,
    );
  }

  stop(): void {
    console.log(`${this.label}: Done`);
  }
}

/**
 * Create a progress bar appropriate for the current environment.
 * Returns InteractiveProgressBar for TTY, SimpleProgressBar for CI/piped output.
 */
export function createProgressBar(options?: ProgressBarOptions): ProgressBar {
  return isInteractive()
    ? new InteractiveProgressBar(options)
    : new SimpleProgressBar(options);
}
