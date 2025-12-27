import { describe, expect, it } from 'vitest';
import {
  DETAILED_GLOBE_HEIGHT,
  getGlobeFrames,
  SIMPLE_GLOBE_HEIGHT,
  TINY_GLOBE_HEIGHT,
  type GlobeStyle,
} from './globe.js';

describe('globe animation', () => {
  describe('getGlobeFrames', () => {
    it('returns multiple frames for tiny style', () => {
      const frames = getGlobeFrames('tiny');
      expect(frames.length).toBeGreaterThan(1);
    });

    it('returns multiple frames for simple style', () => {
      const frames = getGlobeFrames('simple');
      expect(frames.length).toBeGreaterThan(1);
    });

    it('returns multiple frames for detailed style', () => {
      const frames = getGlobeFrames('detailed');
      expect(frames.length).toBeGreaterThan(1);
    });

    it('tiny frames have consistent height', () => {
      const frames = getGlobeFrames('tiny');
      for (const frame of frames) {
        const lines = frame.split('\n');
        expect(lines.length).toBe(TINY_GLOBE_HEIGHT);
      }
    });

    it('simple frames have consistent height', () => {
      const frames = getGlobeFrames('simple');
      for (const frame of frames) {
        const lines = frame.split('\n');
        expect(lines.length).toBe(SIMPLE_GLOBE_HEIGHT);
      }
    });

    it('detailed frames have consistent height', () => {
      const frames = getGlobeFrames('detailed');
      for (const frame of frames) {
        const lines = frame.split('\n');
        expect(lines.length).toBe(DETAILED_GLOBE_HEIGHT);
      }
    });

    it('sizes are ordered tiny < simple < detailed', () => {
      expect(TINY_GLOBE_HEIGHT).toBeLessThan(SIMPLE_GLOBE_HEIGHT);
      expect(SIMPLE_GLOBE_HEIGHT).toBeLessThan(DETAILED_GLOBE_HEIGHT);
    });

    it('all frames in a style have the same width', () => {
      const styles: GlobeStyle[] = ['tiny', 'simple', 'detailed'];
      for (const style of styles) {
        const frames = getGlobeFrames(style);
        // Get max line width from first frame
        const firstFrameLines = frames[0].split('\n');
        const expectedWidth = Math.max(...firstFrameLines.map((l) => l.length));

        for (const frame of frames) {
          const lines = frame.split('\n');
          const maxWidth = Math.max(...lines.map((l) => l.length));
          expect(maxWidth).toBe(expectedWidth);
        }
      }
    });

    it('frames contain globe characters', () => {
      const frames = getGlobeFrames('simple');
      // Frames should contain ASCII characters used for terrain/ocean
      // Characters like @, o, :, ~, . are used in the sphere rendering
      const hasGlobeChars = frames.every(
        (frame) =>
          frame.includes('@') ||
          frame.includes('o') ||
          frame.includes('~') ||
          frame.includes('.'),
      );
      expect(hasGlobeChars).toBe(true);
    });
  });

  describe('globe styles', () => {
    it('tiny globe height is around 9 lines', () => {
      expect(TINY_GLOBE_HEIGHT).toBeGreaterThanOrEqual(7);
      expect(TINY_GLOBE_HEIGHT).toBeLessThanOrEqual(12);
    });

    it('simple globe height is around 17 lines', () => {
      expect(SIMPLE_GLOBE_HEIGHT).toBeGreaterThanOrEqual(15);
      expect(SIMPLE_GLOBE_HEIGHT).toBeLessThanOrEqual(20);
    });

    it('detailed globe height is around 25 lines', () => {
      expect(DETAILED_GLOBE_HEIGHT).toBeGreaterThanOrEqual(20);
      expect(DETAILED_GLOBE_HEIGHT).toBeLessThanOrEqual(30);
    });
  });
});
