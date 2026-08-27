/**
 * Scopo: AssetBrowserOverlay (P12) — strumento di ispezione visuale per sviluppatori.
 *        Permette di consultare tutti i modelli 3D, texture PBR e cue audio
 *        della piramide egizia con relative metriche di polycount e licenza.
 * Ownership: UI.
 */

import manifest from '@/assets/assets.manifest.json' with { type: 'json' };

export interface AssetBrowserOverlay {
  toggle(): void;
  show(): void;
  hide(): void;
  readonly visible: boolean;
  mount(container: HTMLElement): void;
  dispose(): void;
}

export function createAssetBrowserOverlay(
  onPlayAudioCue?: (cueName: string) => void,
): AssetBrowserOverlay {
  let rootEl: HTMLElement | null = null;
  let visible = false;

  function renderContent(): string {
    const modelsHtml = manifest.models
      .map(
        (m) => `
        <div style="background: #1a1614; padding: 6px 10px; border-radius: 4px; border: 1px solid #3d2f24; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span><b>${m.id}</b> <small style="color: #9c8a78;">(${m.category})</small></span>
          <span style="color: #d4a05a;">${m.tris} tris · ${m.license}</span>
        </div>`,
      )
      .join('');

    const texturesHtml = manifest.textures
      .map(
        (t) => `
        <div style="background: #1a1614; padding: 6px 10px; border-radius: 4px; border: 1px solid #3d2f24; margin-bottom: 4px;">
          <div><b>${t.id}</b> <small style="color: #9c8a78;">(${t.type})</small></div>
          <div style="font-size: 10px; color: #8a7b6a;">${t.formats.join(', ')} · ${t.license}</div>
        </div>`,
      )
      .join('');

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #4a3828; padding-bottom: 8px; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #d4a05a; font-family: 'Cinzel', serif;">Asset Browser — La Piramide Perduta</h3>
        <button id="close-asset-browser" style="background: #3a281c; border: 1px solid #6a4a2a; color: #e8d0b0; padding: 4px 10px; cursor: pointer; border-radius: 3px;">Chiudi</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-height: 480px; overflow-y: auto;">
        <div>
          <h4 style="color: #c49a45; margin: 0 0 8px 0;">Modelli 3D (${manifest.models.length})</h4>
          ${modelsHtml}
        </div>
        <div>
          <h4 style="color: #c49a45; margin: 0 0 8px 0;">Texture & PBR (${manifest.textures.length})</h4>
          ${texturesHtml}
          <h4 style="color: #c49a45; margin: 12px 0 8px 0;">Audio & Sintesi</h4>
          <div style="background: #1a1614; padding: 6px 10px; border-radius: 4px; border: 1px solid #3d2f24; font-size: 11px;">
            <div>17 SFX Kenney CC0 · 13 Foley reali</div>
            <div style="color: #6fbf8f; margin-top: 4px;">32 Cue Procedurali WebAudio attivi</div>
          </div>
        </div>
      </div>
    `;
  }

  const overlay: AssetBrowserOverlay = {
    get visible(): boolean {
      return visible;
    },

    toggle(): void {
      if (visible) overlay.hide();
      else overlay.show();
    },

    show(): void {
      visible = true;
      if (rootEl) {
        rootEl.style.display = 'block';
        rootEl.setAttribute('aria-hidden', 'false');
      }
    },

    hide(): void {
      visible = false;
      if (rootEl) {
        rootEl.style.display = 'none';
        rootEl.setAttribute('aria-hidden', 'true');
      }
    },

    mount(container: HTMLElement): void {
      if (rootEl) return;
      rootEl = document.createElement('div');
      rootEl.id = 'asset-browser-overlay';
      rootEl.setAttribute('aria-hidden', 'true');
      rootEl.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 680px; max-width: 90vw; background: rgba(14, 11, 9, 0.96);
        border: 2px solid #6A4824; color: #E8D0B0; font-family: sans-serif;
        font-size: 12px; padding: 16px 20px; border-radius: 8px; z-index: 9999;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.85); display: none;
      `;
      rootEl.innerHTML = renderContent();
      const closeBtn = rootEl.querySelector('#close-asset-browser');
      closeBtn?.addEventListener('click', () => overlay.hide());
      container.appendChild(rootEl);
    },

    dispose(): void {
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootEl = null;
      visible = false;
    },
  };

  void onPlayAudioCue;
  return overlay;
}
