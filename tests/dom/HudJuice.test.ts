import { describe, expect, it } from 'vitest';
import { createHUD, type HUD } from '@/ui/HUD.js';

function mountHUD(): { hud: HUD; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const hud = createHUD();
  hud.mount(container);
  return { hud, container };
}

describe('HUD juice (G-18 V3)', () => {
  it('hitmarker appare e scompare dopo showHitmarker', () => {
    const { hud, container } = mountHUD();
    const markers = container.querySelectorAll('[aria-hidden="true"]');
    // crosshair + hitmarker hanno aria-hidden
    expect(markers.length).toBeGreaterThanOrEqual(1);

    const hitmarker = [...container.querySelectorAll<HTMLElement>('div')]
      .find((el) => el.style.cssText.includes('rotate(45deg)'));
    expect(hitmarker).toBeDefined();
    expect(hitmarker?.style.opacity).toBe('0');
    hud.showHitmarker();
    expect(hitmarker?.style.opacity).toBe('1');
  });

  it('hitmarker differenziale: crit e hit usano colori diversi (v2)', () => {
    const { hud, container } = mountHUD();
    const hitmarker = [...container.querySelectorAll<HTMLElement>('div')]
      .find((el) => el.style.cssText.includes('rotate(45deg)'));
    expect(hitmarker).toBeDefined();
    const bars = () => [...(hitmarker?.querySelectorAll('div') ?? [])];
    hud.showHitmarker('crit');
    const critColor = bars()[0]?.getAttribute('style') ?? '';
    hud.showHitmarker('hit');
    const hitColor = bars()[0]?.getAttribute('style') ?? '';
    hud.showHitmarker('miss');
    const missColor = bars()[0]?.getAttribute('style') ?? '';
    expect(critColor).not.toBe(hitColor);
    expect(missColor).not.toBe(hitColor);
    expect(critColor).toContain('#E85D3A');
  });

  it('la crosshair statica segue applyPresentation', () => {
    const { hud, container } = mountHUD();
    const crosshair = [...container.querySelectorAll<HTMLElement>('div')]
      .find((el) => el.style.cssText.includes('left: 50%') && el.style.cssText.includes('top: 50%'));
    expect(crosshair).toBeDefined();

    hud.applyPresentation({
      textScale: 1,
      highContrast: false,
      colorBlindMode: 'none',
      showDarknessBar: false,
      soundIndicator: false,
      staticCrosshair: true,
    });
    expect(crosshair?.style.opacity).toBe('1');

    hud.applyPresentation({
      textScale: 1,
      highContrast: false,
      colorBlindMode: 'none',
      showDarknessBar: false,
      soundIndicator: false,
      staticCrosshair: false,
    });
    expect(crosshair?.style.opacity).toBe('0');
  });
});
