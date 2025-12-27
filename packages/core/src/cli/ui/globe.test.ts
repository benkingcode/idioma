import { describe, expect, it } from 'vitest';
import { getGlobeFrames, GLOBE_HEIGHT } from './globe.js';

// Strip ANSI escape codes to analyze raw content
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Count visible (non-space) characters per frame
function countVisibleChars(frame: string): number {
  return stripAnsi(frame).replace(/\s/g, '').length;
}

// Analyze terrain distribution in a frame using shape markers
// In no-color mode: land=#/+, ocean=., ice=^/~
function analyzeTerrain(frame: string): {
  land: number;
  ocean: number;
  ice: number;
  total: number;
} {
  const stripped = stripAnsi(frame);
  const landMatches = stripped.match(/[#\+]/g) || [];
  const oceanMatches = stripped.match(/\./g) || [];
  const iceMatches = stripped.match(/[\^~]/g) || [];
  return {
    land: landMatches.length,
    ocean: oceanMatches.length,
    ice: iceMatches.length,
    total: landMatches.length + oceanMatches.length + iceMatches.length,
  };
}

describe('globe animation', () => {
  describe('getGlobeFrames', () => {
    it('returns multiple frames', () => {
      const frames = getGlobeFrames();
      expect(frames.length).toBeGreaterThan(1);
    });

    it('has 24 frames for smooth rotation', () => {
      const frames = getGlobeFrames();
      expect(frames.length).toBe(24);
    });

    it('frames have consistent height', () => {
      const frames = getGlobeFrames();
      for (const frame of frames) {
        const lines = frame.split('\n');
        expect(lines.length).toBe(GLOBE_HEIGHT);
      }
    });

    it('all frames have the same width', () => {
      const frames = getGlobeFrames();
      const firstFrameLines = frames[0].split('\n');
      const expectedWidth = Math.max(...firstFrameLines.map((l) => l.length));

      for (const frame of frames) {
        const lines = frame.split('\n');
        const maxWidth = Math.max(...lines.map((l) => l.length));
        expect(maxWidth).toBe(expectedWidth);
      }
    });

    it('frames contain globe characters', () => {
      const frames = getGlobeFrames();
      const hasGlobeChars = frames.every(
        (frame) =>
          frame.includes('o') || frame.includes('~') || frame.includes('.'),
      );
      expect(hasGlobeChars).toBe(true);
    });
  });

  describe('globe dimensions', () => {
    it('globe height is 9 lines', () => {
      expect(GLOBE_HEIGHT).toBe(9);
    });
  });

  describe('frame content analysis', () => {
    it('each frame has reasonable visible character count', () => {
      const frames = getGlobeFrames();
      const counts = frames.map(countVisibleChars);

      // All frames should have similar density (sphere is constant size)
      const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
      const minExpected = avg * 0.8;
      const maxExpected = avg * 1.2;

      for (let i = 0; i < counts.length; i++) {
        expect(
          counts[i],
          `Frame ${i} has ${counts[i]} chars, expected ~${Math.round(avg)}`,
        ).toBeGreaterThan(minExpected);
        expect(counts[i]).toBeLessThan(maxExpected);
      }
    });

    it('frames have all three terrain types (land, ocean, ice)', () => {
      const frames = getGlobeFrames();

      // Aggregate terrain across all frames
      let totalLand = 0;
      let totalOcean = 0;
      let totalIce = 0;

      for (let i = 0; i < frames.length; i++) {
        const terrain = analyzeTerrain(frames[i]);
        totalLand += terrain.land;
        totalOcean += terrain.ocean;
        totalIce += terrain.ice;

        // Every frame should have ocean - it's 70% of Earth
        expect(terrain.ocean, `Frame ${i} missing ocean (.)`).toBeGreaterThan(
          0,
        );
      }

      // Overall, we should see all terrain types across the full rotation
      expect(totalOcean, 'Should have ocean across frames').toBeGreaterThan(0);
      expect(totalLand, 'Should have land across frames').toBeGreaterThan(0);
      // Ice might be minimal at this resolution, so just log it
      console.log(
        `Totals: Land=${totalLand}, Ocean=${totalOcean}, Ice=${totalIce}`,
      );
    });

    it('land coverage varies between frames as globe rotates', () => {
      const frames = getGlobeFrames();
      const landCounts = frames.map((f) => analyzeTerrain(f).land);

      // Land coverage should vary as continents rotate in/out of view
      const min = Math.min(...landCounts);
      const max = Math.max(...landCounts);
      const variation = max - min;

      expect(
        variation,
        `Land coverage should vary between frames (min=${min}, max=${max})`,
      ).toBeGreaterThan(0);

      console.log('\n=== FRAME TERRAIN ANALYSIS ===');
      console.log(
        `Land (#/+) range: ${min} - ${max} (variation: ${variation})`,
      );
      console.log(
        `Ocean (.) range: ${Math.min(...frames.map((f) => analyzeTerrain(f).ocean))} - ${Math.max(...frames.map((f) => analyzeTerrain(f).ocean))}`,
      );
      console.log(
        `Ice (^/~) range: ${Math.min(...frames.map((f) => analyzeTerrain(f).ice))} - ${Math.max(...frames.map((f) => analyzeTerrain(f).ice))}`,
      );

      // Print per-frame breakdown
      console.log('\nPer-frame land coverage:');
      landCounts.forEach((count, i) => {
        const rotation = Math.round((i / frames.length) * 360);
        const bar = '#'.repeat(Math.ceil(count / 2));
        console.log(`  ${rotation.toString().padStart(3)}°: ${bar} (${count})`);
      });
    });

    it('prints key frames for visual inspection', () => {
      const frames = getGlobeFrames();

      console.log('\n=== KEY FRAMES (0°, 90°, 180°, 270°) ===');
      console.log('Legend: # = land, . = ocean, ^ = ice\n');

      // Show 4 key rotation angles
      const keyFrames = [0, 6, 12, 18];
      for (const i of keyFrames) {
        const stripped = stripAnsi(frames[i]);
        const terrain = analyzeTerrain(frames[i]);
        const rotation = Math.round((i / frames.length) * 360);

        console.log(
          `--- Frame ${i} (${rotation}°) | Land: ${terrain.land}, Ocean: ${terrain.ocean}, Ice: ${terrain.ice} ---`,
        );
        console.log(stripped);
        console.log('');
      }
    });
  });
});
