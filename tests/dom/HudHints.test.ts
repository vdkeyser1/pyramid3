import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHUD, type HUD } from '@/ui/HUD.js';

function mountHUD(): { hud: HUD; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const hud = createHUD();
  hud.mount(container);
  return { hud, container };
}

describe('HUD hint contestuali (tutorial graduale)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  function hintEl(container: HTMLElement): HTMLElement | null {
    return container.querySelector<HTMLElement>('#contextual-hint');
  }

  it('mostra l hint con il testo richiesto e lo nasconde dopo la durata', () => {
    const { hud, container } = mountHUD();
    expect(hintEl(container)).toBeNull(); // creazione lazy

    hud.showContextualHint({ id: 'a', text: 'Primo hint', durationMs: 1000 });

    const el = hintEl(container);
    expect(el).not.toBeNull();
    expect(el?.textContent).toContain('Primo hint');
    expect(el?.style.opacity).toBe('1');
    expect(el?.getAttribute('aria-hidden')).toBe('false');

    vi.advanceTimersByTime(1000);
    expect(el?.style.opacity).toBe('0');
    expect(el?.getAttribute('aria-hidden')).toBe('true');
  });

  it('deduplica per id: lo stesso hint non viene mai ri-mostrato', () => {
    const { hud, container } = mountHUD();
    hud.showContextualHint({ id: 'once', text: 'Solo una volta', durationMs: 1000 });
    hud.showContextualHint({ id: 'once', text: 'Solo una volta', durationMs: 1000 });

    // Primo hint visibile
    const el = hintEl(container);
    expect(el?.textContent).toContain('Solo una volta');

    // Attesa scadenza + fade: se il secondo "once" fosse stato accodato,
    // riapparirebbe; il dedupe per id lo impedisce.
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(400);
    expect(el?.style.opacity).toBe('0');

    // Un hint con id diverso viene mostrato (la coda non è bloccata).
    hud.showContextualHint({ id: 'b', text: 'Secondo', durationMs: 1000 });
    expect(el?.textContent).toContain('Secondo');
    expect(el?.style.opacity).toBe('1');
  });

  it('accoda gli hint: il secondo appare dopo la fine del primo', () => {
    const { hud, container } = mountHUD();
    hud.showContextualHint({ id: 'p1', text: 'Primo della coda', durationMs: 1000 });
    hud.showContextualHint({ id: 'p2', text: 'Secondo della coda', durationMs: 1000 });

    const el = hintEl(container);
    expect(el?.textContent).toContain('Primo della coda');

    vi.advanceTimersByTime(1000); // scade il primo
    vi.advanceTimersByTime(400); // fade + flush della coda
    expect(el?.textContent).toContain('Secondo della coda');
    expect(el?.style.opacity).toBe('1');
  });

  it('dispose rimuove l elemento e azzera la coda', () => {
    const { hud, container } = mountHUD();
    hud.showContextualHint({ id: 'x', text: 'Da pulire', durationMs: 1000 });
    hud.dispose();
    expect(container.querySelector('#contextual-hint')).toBeNull();
    expect(container.querySelector('#game-hud')).toBeNull();
  });
});
