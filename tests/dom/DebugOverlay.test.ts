import { describe, expect, it } from 'vitest';
import { createDebugOverlay } from '@/ui/DebugOverlay.js';

function createContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('DebugOverlay (v2)', () => {
  it('nasce nascosto e il toggle lo mostra/nasconde', () => {
    const overlay = createDebugOverlay();
    overlay.mount(createContainer());
    expect(overlay.visible).toBe(false);
    overlay.toggle();
    expect(overlay.visible).toBe(true);
    overlay.toggle();
    expect(overlay.visible).toBe(false);
    overlay.dispose();
  });

  it('mostra le metriche del debug quando visibile', () => {
    const overlay = createDebugOverlay();
    const container = createContainer();
    overlay.mount(container);
    overlay.toggle();
    overlay.update({
      fps: 60,
      frameMs: 16.6,
      drawCalls: 42,
      triangles: 12345,
      memoryMB: 3.2,
      entityCount: 17,
      floorSeed: 0x1a2b3c4d,
      floorIndex: 3,
      qualityTier: 'medium',
      version: 'v0.1.0',
      renderBackend: 'webgpu',
    });
    const el = container.querySelector('#debug-overlay');
    expect(el).not.toBeNull();
    const text = el?.textContent ?? '';
    expect(text).toContain('42');
    expect(text).toContain('3');
    expect(text).toContain('medium');
    expect(text).toContain('1a2b3c4d');
    overlay.dispose();
  });

  it('aggiorna solo se visibile (zero costo a overlay chiuso)', () => {
    const overlay = createDebugOverlay();
    const container = createContainer();
    overlay.mount(container);
    overlay.update({
      fps: 30, frameMs: 33, drawCalls: 1, triangles: 1, memoryMB: 0,
      entityCount: 1, floorSeed: 1, floorIndex: 1, qualityTier: 'low',
      version: 'v0.1.0', renderBackend: 'webgl2',
    });
    const el = container.querySelector('#debug-overlay');
    expect(el?.textContent ?? '').not.toContain('30');
    overlay.dispose();
  });
});
