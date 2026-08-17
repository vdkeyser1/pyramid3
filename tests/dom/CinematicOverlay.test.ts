/**
 * Test DOM dell'overlay cinematografico (G-15 V5 parziale): vignette, respiro
 * del buio, low-HP, dispose. happy-dom ha document.body disponibile.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { createCinematicOverlay, type CinematicOverlay } from '@/ui/CinematicOverlay.js';

function requireOverlay(): CinematicOverlay {
  const overlay = createCinematicOverlay();
  if (overlay === null) {
    throw new Error('overlay atteso ma era null');
  }
  return overlay;
}

describe('CinematicOverlay (G-15)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('crea l overlay con vignette e grana', () => {
    const overlay = requireOverlay();
    const element = overlay.element;

    expect(element.id).toBe('game-cinematic');
    expect(element.style.pointerEvents).toBe('none');
    expect(document.body.querySelector('#game-cinematic')).not.toBeNull();
    overlay.dispose();
  });

  it('setDarknessBreath clamp a 0..1 e aggiorna l opacità', () => {
    const overlay = requireOverlay();
    const breath = overlay.element.querySelector('#game-cinematic-breath');
    if (breath === null) {
      throw new Error('livello breath atteso');
    }
    const breathEl = breath as HTMLElement;

    overlay.setDarknessBreath(1);
    expect(breathEl.style.opacity).toBe('1');

    overlay.setDarknessBreath(0.4);
    expect(breathEl.style.opacity).toBe('0.4');

    overlay.setDarknessBreath(3); // clamp
    expect(breathEl.style.opacity).toBe('1');
    overlay.dispose();
  });

  it('setLowHp aggiunge box-shadow porpora e lo azzera', () => {
    const overlay = requireOverlay();

    overlay.setLowHp(true);
    expect(overlay.element.style.boxShadow).toContain('rgba(106,51,77,0.35');

    overlay.setLowHp(false);
    // Il reset mantiene il colore con alpha 0 (transizione fluida)
    expect(overlay.element.style.boxShadow).toContain('rgba(106,51,77,0)');
    overlay.dispose();
  });

  it('dispose rimuove l elemento dal DOM', () => {
    const overlay = requireOverlay();
    overlay.dispose();

    expect(document.body.querySelector('#game-cinematic')).toBeNull();
  });
});
