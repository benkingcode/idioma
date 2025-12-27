import chalk from 'chalk';
import { isInteractive } from './env.js';

export const GLOBE_HEIGHT = 9;

// Earth texture map designed for 9×18 low-resolution output
// 72×18 texture (4:1 aspect ratio for equirectangular projection)
// Characters: '.'=ocean, 'o'=land, 'H'=ice
// Longitude: Pacific → Americas → Atlantic → Europe/Africa → Asia → Pacific
const EARTH_TEXTURE = `
........................................................................
............................HHHHHHHH.................HHHHHH.............
.............oo........HHHH....oooo.HHHH........ooooooooooooooo.........
............ooooo..........oo.ooooooo.........oooooooooooooooooooo......
...........oooooooo.......ooo.ooooooo........oooooo...ooooooooooooo.....
...........ooooooooo......ooooooooooo.......ooooo.....oooooooooooooo....
............ooooooo........oooooooo.........ooo.....oo..ooooo..ooo......
.............ooooo.........ooooooooo.........o.........ooo....ooo.......
.............oooo.........oooooooooo.......................oooo........
..............ooo........ooooooooooo......................ooooo........
...............oo.........ooooooooo................................oo..
................o..........oooooo.................................ooooo
.................o..........ooooo................................ooooo.
.....................................oo...........................ooo..
.......................................o...................................
.........................................HHHH...........HHHHHHHHHH......
.......................................HHHHHHHHHHHHHHHHHHHHHHHHHHHHHH...
........................................................................
`
  .trim()
  .split('\n');

/**
 * Render a sphere using the texture map
 * Uses simple spherical projection
 */
function renderSphere(
  width: number,
  height: number,
  rotation: number,
  texture: string[],
): string[] {
  const lines: string[] = [];
  const texHeight = texture.length;
  const texWidth = texture[0]?.length || 1;

  for (let y = 0; y < height; y++) {
    let line = '';
    for (let x = 0; x < width; x++) {
      // Normalize to -1..1 range
      // Note: width = 2*height already compensates for terminal char aspect ratio
      const nx = (x / width) * 2 - 1;
      const ny = (y / height) * 2 - 1;

      // Check if point is inside sphere (unit circle)
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) {
        line += ' ';
        continue;
      }

      // Calculate z coordinate on sphere surface
      const nz = Math.sqrt(1 - r2);

      // Convert to spherical coordinates (latitude, longitude)
      const lat = Math.asin(ny); // -PI/2 to PI/2
      const lon = Math.atan2(nx, nz) + rotation; // -PI to PI, plus rotation

      // Map to texture coordinates
      const texY = Math.floor(((lat + Math.PI / 2) / Math.PI) * texHeight);
      const texX =
        Math.floor(((lon + Math.PI) / (2 * Math.PI)) * texWidth) % texWidth;

      // Clamp texture coordinates
      const ty = Math.max(0, Math.min(texHeight - 1, texY));
      const tx = Math.max(
        0,
        Math.min(texWidth - 1, (texX + texWidth) % texWidth),
      );

      // Get character from texture
      const char = texture[ty]?.[tx] || ' ';

      // Apply color based on character type
      line += colorizeChar(char, nz);
    }
    lines.push(line);
  }

  return lines;
}

// Character palettes for depth shading (brightest to dimmest)
// When colors are available, all terrain uses dots (color provides differentiation)
// When colors are disabled, each terrain type uses distinct characters
const LAND_CHARS_COLOR = ['.', '.', '.', '.', ' '];
const OCEAN_CHARS_COLOR = ['.', '.', '.', '.', ' '];
const ICE_CHARS_COLOR = ['.', '.', '.', '.', ' '];

// No-color fallback: distinct shapes for each terrain type
const LAND_CHARS_NOCOLOR = ['#', '#', '+', '+', ' '];
const OCEAN_CHARS_NOCOLOR = ['.', '.', '.', '.', ' '];
const ICE_CHARS_NOCOLOR = ['^', '^', '~', '~', ' '];

/**
 * Pick a character from palette based on depth (0-1)
 */
function pickChar(palette: string[], depth: number): string {
  const idx = Math.min(
    palette.length - 1,
    Math.floor((1 - depth) * palette.length),
  );
  return palette[idx] ?? palette[0] ?? ' ';
}

/**
 * Get the appropriate character palette based on color support
 */
function getCharPalettes(): {
  land: string[];
  ocean: string[];
  ice: string[];
} {
  // chalk.level: 0 = no colors, 1+ = colors supported
  const hasColors = chalk.level > 0;
  return {
    land: hasColors ? LAND_CHARS_COLOR : LAND_CHARS_NOCOLOR,
    ocean: hasColors ? OCEAN_CHARS_COLOR : OCEAN_CHARS_NOCOLOR,
    ice: hasColors ? ICE_CHARS_COLOR : ICE_CHARS_NOCOLOR,
  };
}

/**
 * Colorize a character based on terrain type and lighting
 */
function colorizeChar(char: string, depth: number): string {
  // Apply non-linear falloff for more dramatic 3D effect
  const adjusted = Math.pow(depth, 0.6);

  // Very edge of sphere - skip rendering for cleaner look
  if (depth < 0.2) {
    return ' ';
  }

  const palettes = getCharPalettes();

  switch (char) {
    case 'o': // Land
      return adjusted > 0.5
        ? chalk.green(pickChar(palettes.land, adjusted))
        : chalk.green.dim(pickChar(palettes.land, adjusted));
    case 'H': // Ice/snow - render as light blue
      return adjusted > 0.5
        ? chalk.cyanBright(pickChar(palettes.ice, adjusted))
        : chalk.cyan.dim(pickChar(palettes.ice, adjusted));
    default: // Ocean
      return adjusted > 0.5
        ? chalk.blue(pickChar(palettes.ocean, adjusted))
        : chalk.blue.dim(pickChar(palettes.ocean, adjusted));
  }
}

/**
 * Generate frames for animation
 */
function generateFrames(
  width: number,
  height: number,
  frameCount: number,
): string[] {
  const frames: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    const rotation = (i / frameCount) * Math.PI * 2;
    const sphereLines = renderSphere(width, height, rotation, EARTH_TEXTURE);
    frames.push(sphereLines.join('\n'));
  }

  return frames;
}

// Pre-generate frames (lazy initialization)
let framesCache: string[] | null = null;

/**
 * Get all frames for the globe animation
 */
export function getGlobeFrames(): string[] {
  if (!framesCache) {
    // 18 chars wide (9 height * 2 for aspect), 9 lines tall, 24 frames for smooth rotation
    framesCache = generateFrames(18, GLOBE_HEIGHT, 24);
  }
  return framesCache;
}

/**
 * Display an animated spinning globe.
 * Runs until user presses any key.
 * Only works in interactive terminal.
 */
export async function displayGlobe(): Promise<void> {
  if (!isInteractive()) {
    console.log('Globe animation requires an interactive terminal.');
    return;
  }

  const frames = getGlobeFrames();
  let frameIndex = 0;

  // Hide cursor
  process.stdout.write('\x1b[?25l');

  // Print instruction
  console.log(chalk.dim('Press any key to stop...\n'));

  // Print initial frame
  console.log(frames[0]);

  const interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % frames.length;
    // Move cursor up to overwrite previous frame
    process.stdout.write(`\x1b[${GLOBE_HEIGHT}A`);
    console.log(frames[frameIndex]);
  }, 150); // 150ms × 24 frames = 3.6s per rotation

  // Set up keypress listener
  const cleanup = () => {
    clearInterval(interval);
    // Show cursor
    process.stdout.write('\x1b[?25h');
  };

  // Handle SIGINT (Ctrl+C)
  const sigintHandler = () => {
    cleanup();
    process.exit(0);
  };
  process.on('SIGINT', sigintHandler);

  // Wait for keypress
  await new Promise<void>((resolve) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        cleanup();
        process.off('SIGINT', sigintHandler);
        resolve();
      });
    } else {
      // If stdin is not TTY, just wait a bit and exit
      setTimeout(() => {
        cleanup();
        resolve();
      }, 5000);
    }
  });
}
