/**
 * Scopo: schermata di riepilogo finale della run (vittoria al piano 10 o conclusione run).
 * Ownership: UI (DOM/CSS puro conforme alle linee guida di accessibilità ed estetica Egyptian Noir).
 *
 * Mostra le statistiche dettagliate della partita:
 *   - Esito (Trionfo nella Necropoli / Gloria nell'Oltretomba)
 *   - Piani superati, Nemici sconfitti, Ka accumulato, Oro raccolto, Tempo totale
 *   - Seed del labirinto con copia negli appunti per sfidare altri giocatori
 *   - Azioni: Riprova discesa / Torna al menu principale
 */

import { resolveUiAccessibilityPalette } from '@/config/AccessibilityPalette.js';

export interface RunSummaryOverlayData {
  readonly victory: boolean;
  readonly cause?: string;
  readonly floorsCleared: number;
  readonly totalFloors?: number;
  readonly enemiesDefeated: number;
  readonly goldEarned: number;
  readonly kaEarnedThisRun: number;
  readonly runDurationMs: number;
  readonly seed: number;
}

export interface RunSummaryOverlay {
  show(data: RunSummaryOverlayData): void;
  hide(): void;
  readonly visible: boolean;
  onRetry: (() => void) | null;
  onReturnToMenu: (() => void) | null;
  applyPresentation(settings: {
    readonly textScale: number;
    readonly highContrast: boolean;
    readonly colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  }): void;
  mount(container: HTMLElement): void;
  dispose(): void;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function createRunSummaryOverlay(): RunSummaryOverlay {
  let rootEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let titleEl: HTMLElement | null = null;
  let subtitleEl: HTMLElement | null = null;
  let statsGridEl: HTMLElement | null = null;
  let seedSectionEl: HTMLElement | null = null;
  let retryBtn: HTMLButtonElement | null = null;
  let visible = false;

  const overlay: RunSummaryOverlay = {
    onRetry: null,
    onReturnToMenu: null,

    get visible(): boolean {
      return visible;
    },

    show(data: RunSummaryOverlayData): void {
      visible = true;
      if (!rootEl) return;
      rootEl.style.display = 'flex';
      render(data);
      retryBtn?.focus();
    },

    hide(): void {
      visible = false;
      if (rootEl) {
        rootEl.style.display = 'none';
      }
    },

    applyPresentation(settings): void {
      const palette = resolveUiAccessibilityPalette(
        settings.colorBlindMode,
        settings.highContrast,
      );
      if (rootEl) {
        rootEl.style.fontSize = `${settings.textScale}em`;
        rootEl.style.color = palette.textColor;
      }
      if (contentEl) {
        contentEl.style.background = palette.surfaceColor;
        contentEl.style.borderColor = palette.borderColor;
      }
    },

    mount(container: HTMLElement): void {
      rootEl = buildPanel();
      rootEl.style.display = 'none';
      container.appendChild(rootEl);
    },

    dispose(): void {
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootEl = null;
      contentEl = null;
      titleEl = null;
      subtitleEl = null;
      statsGridEl = null;
      seedSectionEl = null;
      retryBtn = null;
      visible = false;
    },
  };

  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'run-summary-overlay';
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background:
        radial-gradient(ellipse at 50% 40%, rgba(42, 28, 12, 0.65) 0%, rgba(8, 6, 5, 0.97) 70%),
        repeating-linear-gradient(
          0deg,
          rgba(60, 40, 18, 0.04) 0px,
          rgba(60, 40, 18, 0.04) 1px,
          transparent 1px,
          transparent 4px
        );
      z-index: 120; display: flex; align-items: center; justify-content: center;
      font-family: Cinzel, 'Palatino Linotype', 'Book Antiqua', serif; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    const content = document.createElement('div');
    contentEl = content;
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'summary-title');
    content.style.cssText = `
      background: linear-gradient(165deg, #241A10 0%, #17120C 45%, #100C09 100%);
      border: 2px solid #D4A05A; border-radius: 4px;
      box-shadow: inset 0 0 0 1px #4A3318, 0 16px 48px rgba(0,0,0,0.75);
      padding: 32px 36px; width: min(520px, 94vw);
      display: flex; flex-direction: column; gap: 18px;
      pointer-events: all;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'text-align: center; border-bottom: 1px solid rgba(212,160,90,0.25); padding-bottom: 14px;';

    const title = document.createElement('h2');
    title.id = 'summary-title';
    title.style.cssText = 'margin: 0 0 6px 0; font-size: 1.6rem; letter-spacing: 0.12em; color: #D4A05A;';
    titleEl = title;

    const subtitle = document.createElement('p');
    subtitle.style.cssText = 'margin: 0; font-size: 0.95rem; color: #A89078; font-style: italic;';
    subtitleEl = subtitle;

    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);

    // Stats Grid
    const grid = document.createElement('div');
    grid.style.cssText = `
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      background: rgba(14, 11, 8, 0.65); border: 1px solid rgba(212,160,90,0.18);
      border-radius: 3px; padding: 14px 18px;
    `;
    statsGridEl = grid;
    content.appendChild(grid);

    // Seed Section
    const seedBox = document.createElement('div');
    seedBox.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(28, 21, 14, 0.5); border: 1px dashed rgba(212,160,90,0.3);
      border-radius: 3px; padding: 8px 14px; font-size: 0.88rem;
    `;
    seedSectionEl = seedBox;
    content.appendChild(seedBox);

    // Actions Button Bar
    const buttonBar = document.createElement('div');
    buttonBar.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 4px;';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.textContent = 'Menu Principale';
    menuButton.style.cssText = `
      background: rgba(42, 30, 18, 0.8); color: #C4B090;
      border: 1px solid #7A5A30; border-radius: 2px;
      padding: 10px 20px; font-family: inherit; font-size: 0.92rem;
      cursor: pointer; letter-spacing: 0.06em; transition: all 0.2s ease;
    `;
    menuButton.addEventListener('click', () => {
      overlay.onReturnToMenu?.();
    });

    const retryButton = document.createElement('button');
    retryButton.type = 'button';
    retryButton.textContent = 'Nuova Discesa';
    retryButton.style.cssText = `
      background: linear-gradient(180deg, #8A6428 0%, #5E4216 100%);
      color: #FFF2D0; border: 1px solid #D4A05A; border-radius: 2px;
      padding: 10px 24px; font-family: inherit; font-size: 0.95rem; font-weight: bold;
      cursor: pointer; letter-spacing: 0.08em; transition: all 0.2s ease;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    `;
    retryButton.addEventListener('click', () => {
      overlay.onRetry?.();
    });
    retryBtn = retryButton;

    buttonBar.appendChild(menuButton);
    buttonBar.appendChild(retryButton);
    content.appendChild(buttonBar);

    panel.appendChild(content);
    return panel;
  }

  function render(data: RunSummaryOverlayData): void {
    if (!titleEl || !subtitleEl || !statsGridEl || !seedSectionEl) return;

    if (data.victory) {
      titleEl.innerHTML = '☥ TRIONFO NELLA NECROPOLI ☥';
      titleEl.style.color = '#FFD700';
      subtitleEl.textContent = 'Hai sconfitto i guardiani e svelato i segreti della piramide.';
    } else {
      titleEl.innerHTML = '☥ GLORIA NELL\'OLTRETOMBA ☥';
      titleEl.style.color = '#E0A868';
      subtitleEl.textContent = data.cause ? `Caduto per: ${data.cause}` : 'Il tuo Ka si ricongiunge con la sabbia eterna.';
    }

    const totalF = data.totalFloors ?? 10;
    const items = [
      { label: 'Piani Superati', value: `${data.floorsCleared} / ${totalF}` },
      { label: 'Tempo Discesa', value: formatDuration(data.runDurationMs) },
      { label: 'Nemici Sconfitti', value: `${data.enemiesDefeated}` },
      { label: 'Oro Raccolto', value: `${data.goldEarned} monete` },
      { label: 'Ka Guadagnato', value: `+${data.kaEarnedThisRun} frammenti` },
      { label: 'Esito Finale', value: data.victory ? 'VITTORIA' : 'CADUTO' },
    ];

    statsGridEl.innerHTML = items
      .map(
        (item) => `
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span style="font-size: 0.78rem; color: #8A7258; text-transform: uppercase; letter-spacing: 0.05em;">${item.label}</span>
          <span style="font-size: 1.08rem; color: #E8D4B0; font-weight: bold;">${item.value}</span>
        </div>
      `,
      )
      .join('');

    seedSectionEl.innerHTML = `
      <div style="display: flex; flex-direction: column;">
        <span style="font-size: 0.75rem; color: #8A7258;">SEED DELLA RUN</span>
        <span style="font-family: monospace; color: #2E8B8B; font-weight: bold;">#${data.seed}</span>
      </div>
      <button id="copy-seed-btn" type="button" style="
        background: rgba(46, 139, 139, 0.2); color: #48D1CC; border: 1px solid #2E8B8B;
        border-radius: 2px; padding: 5px 12px; font-size: 0.82rem; cursor: pointer;
        font-family: inherit; transition: all 0.2s;
      ">Copia per Sfida</button>
    `;

    const copyBtn = seedSectionEl.querySelector<HTMLButtonElement>('#copy-seed-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        void navigator.clipboard.writeText(String(data.seed)).then(() => {
          copyBtn.textContent = '✓ Copiato!';
          copyBtn.style.color = '#7CFC00';
          setTimeout(() => {
            copyBtn.textContent = 'Copia per Sfida';
            copyBtn.style.color = '#48D1CC';
          }, 2000);
        });
      });
    }
  }

  return overlay;
}
