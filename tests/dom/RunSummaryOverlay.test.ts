/**
 * Test DOM di RunSummaryOverlay (MET-05) sotto happy-dom.
 * Verifica rendering vittoria/sconfitta, formattazione statistiche, seed e callbacks.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { createRunSummaryOverlay, type RunSummaryOverlay } from '@/ui/RunSummaryOverlay.js';

function mountOverlay(): { overlay: RunSummaryOverlay; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const overlay = createRunSummaryOverlay();
  overlay.mount(container);
  return { overlay, container };
}

function findOverlayRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>('#run-summary-overlay');
  if (!root) {
    throw new Error('#run-summary-overlay non trovato nel DOM');
  }
  return root;
}

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent.includes(text),
  );
  if (!button) {
    throw new Error(`bottone con testo "${text}" non trovato`);
  }
  return button;
}

describe('RunSummaryOverlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('è nascosto di default e si mostra con show()', () => {
    const { overlay, container } = mountOverlay();
    const root = findOverlayRoot(container);

    expect(overlay.visible).toBe(false);
    expect(root.style.display).toBe('none');

    overlay.show({
      victory: true,
      floorsCleared: 10,
      totalFloors: 10,
      enemiesDefeated: 24,
      goldEarned: 350,
      kaEarnedThisRun: 120,
      runDurationMs: 145000,
      seed: 98765,
    });

    expect(overlay.visible).toBe(true);
    expect(root.style.display).toBe('flex');

    overlay.hide();
    expect(overlay.visible).toBe(false);
    expect(root.style.display).toBe('none');
  });

  it('mostra il messaggio di trionfo e statistiche complete in caso di vittoria', () => {
    const { overlay, container } = mountOverlay();

    overlay.show({
      victory: true,
      floorsCleared: 10,
      totalFloors: 10,
      enemiesDefeated: 32,
      goldEarned: 500,
      kaEarnedThisRun: 200,
      runDurationMs: 185000, // 03:05
      seed: 12345,
    });

    expect(container.textContent).toContain('TRIONFO NELLA NECROPOLI');
    expect(container.textContent).toContain('10 / 10');
    expect(container.textContent).toContain('03:05');
    expect(container.textContent).toContain('32');
    expect(container.textContent).toContain('500 monete');
    expect(container.textContent).toContain('+200 frammenti');
    expect(container.textContent).toContain('#12345');
  });

  it('mostra il messaggio di gloria e causa della morte in caso di sconfitta', () => {
    const { overlay, container } = mountOverlay();

    overlay.show({
      victory: false,
      cause: 'Guardiana della Cripta',
      floorsCleared: 4,
      totalFloors: 10,
      enemiesDefeated: 8,
      goldEarned: 90,
      kaEarnedThisRun: 30,
      runDurationMs: 62000, // 01:02
      seed: 54321,
    });

    expect(container.textContent).toContain('GLORIA NELL\'OLTRETOMBA');
    expect(container.textContent).toContain('Caduto per: Guardiana della Cripta');
    expect(container.textContent).toContain('4 / 10');
    expect(container.textContent).toContain('01:02');
  });

  it('esegue i callback onRetry e onReturnToMenu', () => {
    const { overlay, container } = mountOverlay();
    let retryCalled = false;
    let menuCalled = false;

    overlay.onRetry = () => {
      retryCalled = true;
    };
    overlay.onReturnToMenu = () => {
      menuCalled = true;
    };

    overlay.show({
      victory: false,
      floorsCleared: 2,
      enemiesDefeated: 3,
      goldEarned: 20,
      kaEarnedThisRun: 5,
      runDurationMs: 30000,
      seed: 101,
    });

    const retryBtn = findButtonByText(container, 'Nuova Discesa');
    retryBtn.click();
    expect(retryCalled).toBe(true);

    const menuBtn = findButtonByText(container, 'Menu Principale');
    menuBtn.click();
    expect(menuCalled).toBe(true);
  });

  it('applica la presentazione accessibile e rimuove il nodo con dispose', () => {
    const { overlay, container } = mountOverlay();

    overlay.applyPresentation({
      textScale: 1.25,
      highContrast: true,
      colorBlindMode: 'none',
    });

    const root = findOverlayRoot(container);
    expect(root.style.fontSize).toBe('1.25em');

    overlay.dispose();
    expect(container.querySelector('#run-summary-overlay')).toBeNull();
  });
});
