import { describe, expect, it } from 'vitest';
import { createAssetBrowserOverlay } from '@/ui/AssetBrowserOverlay.js';

describe('AssetBrowserOverlay — Browser e ispezione asset dev (P12)', () => {
  it('monta il container nel DOM e gestisce la visibilità con toggle/show/hide', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = createAssetBrowserOverlay();
    overlay.mount(container);

    expect(overlay.visible).toBe(false);
    const el = document.getElementById('asset-browser-overlay');
    expect(el).not.toBeNull();
    expect(el?.style.display).toBe('none');

    overlay.show();
    expect(overlay.visible).toBe(true);
    expect(el?.style.display).toBe('block');

    overlay.hide();
    expect(overlay.visible).toBe(false);
    expect(el?.style.display).toBe('none');

    overlay.toggle();
    expect(overlay.visible).toBe(true);

    overlay.dispose();
    expect(document.getElementById('asset-browser-overlay')).toBeNull();
    container.remove();
  });

  it('mostra correttamente i modelli del manifest egizio', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = createAssetBrowserOverlay();
    overlay.mount(container);

    const el = document.getElementById('asset-browser-overlay');
    expect(el?.innerHTML).toContain('mummy');
    expect(el?.innerHTML).toContain('statue_anubis');
    expect(el?.innerHTML).toContain('sarcophagus');

    overlay.dispose();
    container.remove();
  });
});
