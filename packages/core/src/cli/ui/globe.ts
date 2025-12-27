import chalk from 'chalk';
import { isInteractive } from './env.js';

export type GlobeStyle = 'tiny' | 'simple' | 'detailed';

export const TINY_GLOBE_HEIGHT = 9;
export const SIMPLE_GLOBE_HEIGHT = 17;
export const DETAILED_GLOBE_HEIGHT = 25;

// Simplified Earth texture map with recognizable continent shapes
// Optimized for low-resolution rendering (cleaner shapes that read well at small sizes)
// Characters: '.'=ocean, 'o'=land, 'H'=ice
const EARTH_TEXTURE = `
....................................................................................................
....................................................................................................
.......................................HHHHHHHHHHHHHH...............................................
.......................oooo.......HHHH.....ooooooooooo.HH.....oooooooooooooooooo....................
.....................ooooooo.....H........oooooooooooooo.....ooooooooooooooooooooooo.................
....................oooooooooo...........ooooooooooooooo....oooooooooooooooooooooooooo...............
....................ooooooooooo..........ooooooooooooooo...ooooooooooooooooooooooooooooo.............
...................oooooooooooo.........oooooooooooooo....ooooooooooooooooooooooooooooo..............
...................ooooooooooooo.........ooooooooooo.....oooooooooooooooooooooooooooo................
....................ooooooooooo..........ooooooooo......ooooooooooooooooooooooooooo..................
.....................oooooooooo..........ooooooo.......ooooooooooooooooo.............................
......................ooooooo.............ooooo........oooooooooo....................................
.......................ooooo.............oooooo........ooooooo.............................oo.......
........................oooo............ooooooo.......ooooo...............................oooo......
.........................ooo............oooooooo......oooo...............................ooooo......
..........................oo...........ooooooooo.....ooo................................oooooo.....
..........................oo..........oooooooooo....oo..................................ooooo......
...........................o.........ooooooooooo...o.....................................ooo.......
............................o.......oooooooooooo.........................................oo........
.............................o.....oooooooooo............................................o.........
....................................ooooooooo...................................................HHH.
.....................................ooooooo..................................................HHHHH
......................................ooooo.................................................HHHHHH
.......................................ooo................................................HHHHHHH
........................................o...............................................HHHHHHHHHH
....................................................................................................
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
const LAND_CHARS = ['o', 'o', 'o', '.', '.'];
const OCEAN_CHARS = ['.', '.', '.', '.', ' '];

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
 * Colorize a character based on terrain type and lighting
 */
function colorizeChar(char: string, depth: number): string {
  // Apply non-linear falloff for more dramatic 3D effect
  const adjusted = Math.pow(depth, 0.6);

  // Very edge of sphere - skip rendering for cleaner look
  if (depth < 0.2) {
    return ' ';
  }

  switch (char) {
    case 'o': // Land
      return adjusted > 0.5
        ? chalk.green(pickChar(LAND_CHARS, adjusted))
        : chalk.green.dim(pickChar(LAND_CHARS, adjusted));
    case 'H': // Ice/snow - render as light blue
      return adjusted > 0.5
        ? chalk.cyanBright(pickChar(OCEAN_CHARS, adjusted))
        : chalk.cyan.dim(pickChar(OCEAN_CHARS, adjusted));
    default: // Ocean
      return adjusted > 0.5
        ? chalk.blue(pickChar(OCEAN_CHARS, adjusted))
        : chalk.blue.dim(pickChar(OCEAN_CHARS, adjusted));
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

// Pre-generate frames for all styles
let tinyFramesCache: string[] | null = null;
let simpleFramesCache: string[] | null = null;
let detailedFramesCache: string[] | null = null;

function getTinyFrames(): string[] {
  if (!tinyFramesCache) {
    // Tiny: 18 chars wide (9 height * 2 for aspect), 9 lines tall, 8 frames
    tinyFramesCache = generateFrames(18, TINY_GLOBE_HEIGHT, 8);
  }
  return tinyFramesCache;
}

function getSimpleFrames(): string[] {
  if (!simpleFramesCache) {
    // Simple: 34 chars wide (17 height * 2 for aspect), 17 lines tall, 12 frames
    simpleFramesCache = generateFrames(34, SIMPLE_GLOBE_HEIGHT, 12);
  }
  return simpleFramesCache;
}

function getDetailedFrames(): string[] {
  if (!detailedFramesCache) {
    // Detailed: 50 chars wide (25 height * 2 for aspect), 25 lines tall, 20 frames
    detailedFramesCache = generateFrames(50, DETAILED_GLOBE_HEIGHT, 20);
  }
  return detailedFramesCache;
}

/**
 * Get all frames for a globe style
 */
export function getGlobeFrames(style: GlobeStyle): string[] {
  if (style === 'tiny') return getTinyFrames();
  if (style === 'simple') return getSimpleFrames();
  return getDetailedFrames();
}

/**
 * Display an animated spinning globe.
 * Runs until user presses any key.
 * Only works in interactive terminal.
 */
export async function displayGlobe(
  style: GlobeStyle = 'detailed',
): Promise<void> {
  if (!isInteractive()) {
    console.log('Globe animation requires an interactive terminal.');
    return;
  }

  const frames = getGlobeFrames(style);
  const frameHeight =
    style === 'tiny'
      ? TINY_GLOBE_HEIGHT
      : style === 'simple'
        ? SIMPLE_GLOBE_HEIGHT
        : DETAILED_GLOBE_HEIGHT;
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
    process.stdout.write(`\x1b[${frameHeight}A`);
    console.log(frames[frameIndex]);
  }, 320);

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
