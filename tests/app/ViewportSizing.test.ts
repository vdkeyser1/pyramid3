import { describe, expect, it, vi } from 'vitest';
import { applyViewportMetrics, measureViewportMetrics } from '@/app/ViewportSizing.js';

describe('ViewportSizing', () => {
  it('clamps width, height and pixel ratio to safe values', () => {
    const metrics = measureViewportMetrics(
      {
        clientWidth: 0.4,
        clientHeight: 0,
      },
      0,
    );

    expect(metrics).toEqual({
      width: 1,
      height: 1,
      pixelRatio: 1,
      pixelWidth: 1,
      pixelHeight: 1,
    });
  });

  it('applies rounded canvas metrics and resizes the renderer', () => {
    const canvas = {
      clientWidth: 539.6,
      clientHeight: 959.5,
      width: 0,
      height: 0,
    };
    const renderer = {
      resize: vi.fn(),
    };

    const metrics = applyViewportMetrics(canvas, renderer, 1.5);

    expect(metrics).toEqual({
      width: 540,
      height: 960,
      pixelRatio: 1.5,
      pixelWidth: 810,
      pixelHeight: 1440,
    });
    expect(canvas.width).toBe(810);
    expect(canvas.height).toBe(1440);
    expect(renderer.resize).toHaveBeenCalledWith(540, 960, 1.5);
  });
});
