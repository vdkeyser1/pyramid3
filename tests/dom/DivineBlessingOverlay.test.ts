import { describe, expect, it, vi } from 'vitest';
import { createDivineBlessingOverlay } from '@/ui/DivineBlessingOverlay.js';
import { DIVINE_BLESSINGS } from '@/content/DivineBlessings.js';

describe('DivineBlessingOverlay — UI selezione benedizioni divine', () => {
  it('monta il componente, mostra le carte benedizione e risponde al click', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = createDivineBlessingOverlay();
    overlay.mount(container);

    const b1 = DIVINE_BLESSINGS[0]!;
    const b2 = DIVINE_BLESSINGS[1]!;

    const onSelect = vi.fn();
    const onDismiss = vi.fn();

    overlay.show([b1, b2], 100, onSelect, onDismiss);
    expect(overlay.visible).toBe(true);

    const el = document.getElementById('divine-blessing-overlay');
    expect(el?.innerHTML).toContain(b1.name);
    expect(el?.innerHTML).toContain(b2.name);

    // Click card 1
    const card1 = el?.querySelectorAll('.blessing-card')[0] as HTMLElement;
    card1?.click();

    expect(onSelect).toHaveBeenCalledWith(b1);
    expect(overlay.visible).toBe(false);

    overlay.dispose();
    container.remove();
  });

  it('gestisce fondi insufficienti disabilitando la selezione', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = createDivineBlessingOverlay();
    overlay.mount(container);

    const b1 = DIVINE_BLESSINGS[0]!; // goldCost: 45
    const b2 = DIVINE_BLESSINGS[1]!; // goldCost: 40

    const onSelect = vi.fn();
    overlay.show([b1, b2], 10, onSelect); // solo 10 oro

    const el = document.getElementById('divine-blessing-overlay');
    expect(el?.innerHTML).toContain('(Insuff.)');

    overlay.dispose();
    container.remove();
  });
});
