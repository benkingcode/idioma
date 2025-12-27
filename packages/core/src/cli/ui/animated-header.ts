import chalk from 'chalk';
import { isInteractive } from './env.js';
import { getGlobeFrames, GLOBE_HEIGHT } from './globe.js';

/**
 * Configuration options for the animated header.
 */
export interface AnimatedHeaderOptions {
  /** Title to display (e.g., "idioma translate") */
  title: string;
  /** Whether auto-context generation is enabled */
  autoContext: boolean;
  /** AI provider name (e.g., "anthropic", "openai") */
  provider: string;
  /** Optional model name */
  model?: string;
}

/**
 * Interface for animated header that displays during command execution.
 * The header manages all terminal output to avoid cursor conflicts.
 */
export interface AnimatedHeader {
  /** Start the animated header display */
  start(options: AnimatedHeaderOptions): void;
  /** Update the status line below the header */
  setStatus(text: string): void;
  /** Update progress display */
  setProgress(label: string, current: number, total: number): void;
  /** Log a completed item (stays visible) */
  log(text: string): void;
  /** Stop animation (leaves final frame visible, restores cursor) */
  stop(): void;
}

const GLOBE_WIDTH = 18;
const GAP = '    '; // 4 spaces between globe and info
const CONTENT_LINES = 4; // Fixed number of content lines below header

/**
 * Format model info for display.
 * Truncates long model names to avoid breaking layout.
 */
function formatModelInfo(provider: string, model?: string): string {
  if (model) {
    const maxLen = 25;
    const shortModel =
      model.length > maxLen ? model.slice(0, maxLen - 3) + '...' : model;
    return `${provider} ${chalk.dim(`(${shortModel})`)}`;
  }
  return provider;
}

/**
 * Render a single header frame combining globe and info text.
 */
function renderHeaderFrame(
  globeFrame: string,
  options: AnimatedHeaderOptions,
): string {
  const globeLines = globeFrame.split('\n');

  // Build info lines (9 total to match globe height)
  // Position title on line 3, config on lines 5-6 (vertically centered)
  const infoLines: string[] = [
    '', // Line 0: padding
    '', // Line 1: padding
    '', // Line 2: padding
    chalk.bold.cyan(options.title), // Line 3: title
    '', // Line 4: padding
    `Auto context: ${options.autoContext ? chalk.green('on') : chalk.dim('off')}`, // Line 5
    `Model: ${formatModelInfo(options.provider, options.model)}`, // Line 6
    '', // Line 7: padding
    '', // Line 8: padding
  ];

  // Combine globe + info for each line
  return globeLines
    .map((globeLine, i) => {
      const paddedGlobe = globeLine.padEnd(GLOBE_WIDTH, ' ');
      return paddedGlobe + GAP + (infoLines[i] ?? '');
    })
    .join('\n');
}

/**
 * Render a progress bar.
 */
function renderProgressBar(
  label: string,
  current: number,
  total: number,
  width = 40,
): string {
  if (total === 0) return `${label} (no items)`;

  const percent = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  return `${label} ${bar} ${current}/${total} | ${percent}%`;
}

/**
 * Interactive animated header using globe animation.
 * Shows spinning globe alongside config info in TTY environments.
 * Manages all output to prevent cursor conflicts.
 */
export class InteractiveAnimatedHeader implements AnimatedHeader {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private frames: string[] = [];
  private totalHeight = GLOBE_HEIGHT + 1 + CONTENT_LINES; // header + blank + content
  private hasDrawn = false; // Track if we've drawn at least once

  // Content area state
  private statusText = '';
  private progressLabel = '';
  private progressCurrent = 0;
  private progressTotal = 0;
  private logLines: string[] = [];

  start(options: AnimatedHeaderOptions): void {
    const globeFrames = getGlobeFrames();
    this.frames = globeFrames.map((frame) => renderHeaderFrame(frame, options));
    this.frameIndex = 0;
    this.hasDrawn = false;
    this.statusText = '';
    this.progressLabel = '';
    this.progressCurrent = 0;
    this.progressTotal = 0;
    this.logLines = [];

    // Hide cursor
    process.stdout.write('\x1b[?25l');

    // Draw initial state
    this.draw();

    // Start animation loop
    this.intervalId = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      this.draw();
    }, 150);
  }

  setStatus(text: string): void {
    this.statusText = text;
    // Progress is cleared when status changes
    this.progressLabel = '';
    this.progressCurrent = 0;
    this.progressTotal = 0;
  }

  setProgress(label: string, current: number, total: number): void {
    this.progressLabel = label;
    this.progressCurrent = current;
    this.progressTotal = total;
    // Clear status when showing progress
    this.statusText = '';
  }

  log(text: string): void {
    // Add to log lines, keep only last few
    this.logLines.push(text);
    // Keep enough lines to fill content area
    while (this.logLines.length > CONTENT_LINES) {
      this.logLines.shift();
    }
    // Clear status/progress when logging
    this.statusText = '';
    this.progressLabel = '';
  }

  private draw(): void {
    // Move to start of our region
    // On first draw, we're at start. On subsequent draws, move up.
    if (this.hasDrawn) {
      // Move cursor up to start of region
      process.stdout.write(`\x1b[${this.totalHeight}A`);
    }
    this.hasDrawn = true;

    // Clear from cursor to end of screen (in case content changed)
    process.stdout.write('\x1b[J');

    // Draw header
    process.stdout.write(this.frames[this.frameIndex] + '\n');

    // Blank line
    process.stdout.write('\n');

    // Draw content area
    const contentLines = this.buildContentLines();
    for (let i = 0; i < CONTENT_LINES; i++) {
      process.stdout.write((contentLines[i] ?? '') + '\n');
    }
  }

  private buildContentLines(): string[] {
    const lines: string[] = [];

    // Add log lines first
    for (const logLine of this.logLines) {
      lines.push(logLine);
    }

    // Add status or progress on next available line
    if (this.statusText) {
      lines.push(this.statusText);
    } else if (this.progressLabel) {
      lines.push(
        renderProgressBar(
          this.progressLabel,
          this.progressCurrent,
          this.progressTotal,
        ),
      );
    }

    return lines;
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Final redraw to ensure clean state
    this.draw();
    // Show cursor
    process.stdout.write('\x1b[?25h');
  }
}

/**
 * Simple non-animated header for CI/non-TTY environments.
 * Prints a single static line with config info.
 */
export class SimpleAnimatedHeader implements AnimatedHeader {
  private options: AnimatedHeaderOptions | null = null;

  start(options: AnimatedHeaderOptions): void {
    this.options = options;
    const contextStatus = options.autoContext ? 'on' : 'off';
    const modelInfo = options.model
      ? `${options.provider} (${options.model})`
      : options.provider;

    console.log(
      `${options.title} | Auto context: ${contextStatus} | Model: ${modelInfo}`,
    );
    console.log('');
  }

  setStatus(text: string): void {
    console.log(text);
  }

  setProgress(label: string, current: number, total: number): void {
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    console.log(`${label}: ${current}/${total} (${percent}%)`);
  }

  log(text: string): void {
    console.log(text);
  }

  stop(): void {
    // No-op - nothing to clean up
  }
}

/**
 * Create an animated header appropriate for the current environment.
 * Returns InteractiveAnimatedHeader for TTY, SimpleAnimatedHeader for CI/piped output.
 */
export function createAnimatedHeader(): AnimatedHeader {
  return isInteractive()
    ? new InteractiveAnimatedHeader()
    : new SimpleAnimatedHeader();
}
