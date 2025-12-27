import { describe, expect, it } from 'vitest';
import { getGlobeFrames, GLOBE_HEIGHT } from './globe.js';

describe('globe animation', () => {
  describe('getGlobeFrames', () => {
    it('returns multiple frames', () => {
      const frames = getGlobeFrames();
      expect(frames.length).toBeGreaterThan(1);
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
});
