import { describe, expect, it } from 'vitest';
import { createHUD } from '@/ui/HUD.js';

function querySubtitle(): HTMLElement | null {
  return document.querySelector('#game-hud div[aria-live="polite"]');
}

describe('HUD sottotitoli (C-03)', () => {
  it('non mostra sottotitoli se subtitleNames è disattivo', () => {
    const hud = createHUD();
    hud.mount(document.body);
    hud.setSubtitlePreferences({ names: false, directions: false });

    hud.showMessage('Testo di prova', 1000);
    const bar = querySubtitle();
    expect(bar).not.toBeNull();
    expect(bar?.style.display).toBe('none');

    hud.dispose();
  });

  it('showMessage con nomi attivi e direzione popola la barra (niente doppioni)', () => {
    const hud = createHUD();
    hud.mount(document.body);
    hud.setSubtitlePreferences({ names: true, directions: false });

    // Con direzione: il testo vive SOLO nella barra sottotitoli.
    hud.showMessage('La torcia si spegne.', 100, 'back');
    const bar = querySubtitle();
    expect(bar?.textContent).toContain('La torcia si spegne');
    expect(bar?.style.display).toBe('block');

    // Senza direzione: il testo vive nel messaggio centrale (barra spenta).
    hud.showMessage('Oro raccolto.', 100);
    expect(querySubtitle()?.textContent).not.toContain('Oro raccolto');

    hud.dispose();
  });

  it('mostra la freccia di direzione solo con subtitleDirections attivo', () => {
    const hud = createHUD();
    hud.mount(document.body);

    hud.setSubtitlePreferences({ names: true, directions: true });
    hud.showSubtitle('Un ruggito alle spalle', { direction: 'back', durationMs: 100 });
    expect(querySubtitle()?.textContent).toContain('⬇');

    hud.setSubtitlePreferences({ names: true, directions: false });
    hud.showSubtitle('Un ruggito alle spalle', { direction: 'back', durationMs: 100 });
    expect(querySubtitle()?.textContent).not.toContain('⬇');
    expect(querySubtitle()?.textContent).toContain('Un ruggito alle spalle');

    hud.dispose();
  });

  it('mostra lo speaker quando fornito (subtitleNames)', () => {
    const hud = createHUD();
    hud.mount(document.body);
    hud.setSubtitlePreferences({ names: true, directions: false });

    hud.showSubtitle('Ti ho sentito.', { speaker: 'Mummia', durationMs: 100 });
    expect(querySubtitle()?.textContent).toContain('Mummia');

    hud.dispose();
  });

  it('dispose pulisce il timer e smonta il root (nessun errore)', () => {
    const hud = createHUD();
    hud.mount(document.body);
    hud.setSubtitlePreferences({ names: true, directions: false });
    hud.showSubtitle('Breve', { durationMs: 5 });
    expect(() => {
      hud.dispose();
    }).not.toThrow();
    expect(document.querySelector('#game-hud')).toBeNull();
    document.body.innerHTML = '';
  });
});
