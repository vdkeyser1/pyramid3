/**
 * Scopo: debug overlay (v2) — toggle con F3/Backquote per profiling in-game:
 * draw calls, ms/frame, entity count, floor seed, tier qualità, versione.
 * Ownership: UI. Consumato da GameApplication (toggle + update per frame).
 * Invarianti:
 *   - puramente informativo: nessun effetto sul gameplay;
 *   - z-index sopra l'HUD, sotto gli overlay modali (morte/impostazioni);
 *   - aria-hidden quando nascosto (niente rumore per screen reader).
 */

export interface DebugOverlayData {
  readonly fps: number;
  readonly frameMs: number;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly memoryMB: number;
  readonly entityCount: number;
  readonly floorSeed: number;
  readonly floorIndex: number;
  readonly qualityTier: string;
  readonly version: string;
  readonly renderBackend: string;
}

export interface DebugOverlay {
  toggle(): void;
  update(data: DebugOverlayData): void;
  readonly visible: boolean;
  mount(container: HTMLElement): void;
  dispose(): void;
}

export function createDebugOverlay(): DebugOverlay {
  let rootEl: HTMLElement | null = null;
  let bodyEl: HTMLElement | null = null;
  let visible = false;

  const overlay: DebugOverlay = {
    get visible(): boolean {
      return visible;
    },

    toggle(): void {
      visible = !visible;
      if (rootEl) {
        rootEl.style.display = visible ? 'block' : 'none';
        rootEl.setAttribute('aria-hidden', String(!visible));
      }
    },

    update(data: DebugOverlayData): void {
      if (!visible || !bodyEl) return;
      bodyEl.innerHTML = `
        <div><b>La Piramide Perduta</b> ${data.version} · ${data.renderBackend}</div>
        <div>FPS ${data.fps} · frame ${data.frameMs.toFixed(1)}ms</div>
        <div>Draw calls ${data.drawCalls} · triangoli ${data.triangles.toLocaleString('it-IT')} · mem ${data.memoryMB}MB</div>
        <div>Entity ${data.entityCount} · quality ${data.qualityTier}</div>
        <div>Piano ${data.floorIndex} · seed ${data.floorSeed.toString(16)}</div>
      `;
    },

    mount(container: HTMLElement): void {
      if (rootEl) return;
      rootEl = document.createElement('div');
      rootEl.id = 'debug-overlay';
      rootEl.setAttribute('aria-hidden', 'true');
      rootEl.style.cssText = `
        position: fixed; top: 12px; left: 12px; z-index: 40;
        background: rgba(11, 9, 8, 0.88); border: 1px solid #4A2F1A;
        color: #6FBF8F; font-family: monospace; font-size: 11px;
        padding: 8px 12px; border-radius: 4px; line-height: 1.6;
        display: none; pointer-events: none; user-select: none;
      `;
      bodyEl = document.createElement('div');
      rootEl.appendChild(bodyEl);
      container.appendChild(rootEl);
    },

    dispose(): void {
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootEl = null;
      bodyEl = null;
      visible = false;
    },
  };

  return overlay;
}
