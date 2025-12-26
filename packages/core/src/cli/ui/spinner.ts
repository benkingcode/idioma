import chalk from 'chalk';
import ora, { type Ora } from 'ora';
import { isInteractive } from './env.js';

/**
 * Interface for a spinner that shows indeterminate progress.
 * Used for stage-based operations like extract and compile.
 */
export interface Spinner {
  /** Start the spinner with initial text */
  start(text: string): void;
  /** Update the spinner text */
  update(text: string): void;
  /** Stop with success state */
  succeed(text?: string): void;
  /** Stop with failure state */
  fail(text?: string): void;
  /** Stop the spinner (cleanup) */
  stop(): void;
}

/**
 * Interactive spinner using ora.
 * Shows animated spinner in TTY environments.
 */
export class InteractiveSpinner implements Spinner {
  private spinner: Ora | null = null;
  private currentText = '';

  start(text: string): void {
    this.currentText = text;
    this.spinner = ora({
      text,
      stream: process.stderr,
    }).start();
  }

  update(text: string): void {
    this.currentText = text;
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  succeed(text?: string): void {
    const message = text ?? this.currentText;
    if (this.spinner) {
      this.spinner.succeed(message);
      this.spinner = null;
    } else {
      // If succeed() is called without start(), just print the success message
      console.log(chalk.green('✓') + ' ' + message);
    }
  }

  fail(text?: string): void {
    const message = text ?? this.currentText;
    if (this.spinner) {
      this.spinner.fail(message);
      this.spinner = null;
    } else {
      // If fail() is called without start(), just print the failure message
      console.log(chalk.red('✗') + ' ' + message);
    }
  }

  stop(): void {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }
}

/**
 * Simple spinner for CI/non-TTY environments.
 * Uses plain console.log instead of animated spinner.
 */
export class SimpleSpinner implements Spinner {
  private currentText = '';

  start(text: string): void {
    this.currentText = text;
    console.log(text);
  }

  update(text: string): void {
    this.currentText = text;
    console.log(text);
  }

  succeed(text?: string): void {
    console.log(chalk.green('✓') + ' ' + (text ?? this.currentText));
  }

  fail(text?: string): void {
    console.log(chalk.red('✗') + ' ' + (text ?? this.currentText));
  }

  stop(): void {
    // No-op for simple spinner
  }
}

/**
 * Create a spinner appropriate for the current environment.
 * Returns InteractiveSpinner for TTY, SimpleSpinner for CI/piped output.
 */
export function createSpinner(): Spinner {
  return isInteractive() ? new InteractiveSpinner() : new SimpleSpinner();
}
