import { resolveUiAccessibilityPalette } from '@/config/AccessibilityPalette.js';
import type { LeaderboardEntry } from '@/progression/Leaderboard.js';

export interface DeathOverlayData {
  readonly cause: string;
  readonly fragments: number | null;
  readonly canRetry: boolean;
  /** Run summary (v2): statistiche della run appena conclusa. */
  readonly floorsCleared: number;
  readonly enemiesDefeated: number;
  readonly goldEarned: number;
  /** Ka Fragments guadagnati IN QUESTA run (non il totale). */
  readonly kaEarnedThisRun: number;
  /** Durata della run in millisecondi. */
  readonly runDurationMs: number;
  /** True se questa run ha battuto il record personale (piani). */
  readonly isPersonalRecord: boolean;
  /** C-01: classifica locale (top 3) per la schermata di morte. */
  readonly leaderboard?: readonly LeaderboardEntry[];
  /** C-01: URL condivisibile del seed di questa run. */
  readonly shareUrl?: string;
}

export interface DeathOverlay {
  show(data: DeathOverlayData): void;
  hide(): void;
  setRetryEnabled(enabled: boolean): void;
  readonly visible: boolean;
  onRetry: (() => void) | null;
  applyPresentation(settings: {
    readonly textScale: number;
    readonly highContrast: boolean;
    readonly colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  }): void;
  mount(container: HTMLElement): void;
  dispose(): void;
}

export function createDeathOverlay(): DeathOverlay {
  let rootEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let retryButtonEl: HTMLButtonElement | null = null;
  let causeEl: HTMLElement | null = null;
  let fragmentsEl: HTMLElement | null = null;
  let statsEl: HTMLElement | null = null;
  let leaderboardEl: HTMLElement | null = null;
  let shareEl: HTMLButtonElement | null = null;
  let visible = false;

  const overlay: DeathOverlay = {
    onRetry: null,

    get visible(): boolean {
      return visible;
    },

    show(data: DeathOverlayData): void {
      visible = true;
      if (rootEl) {
        rootEl.style.display = 'flex';
        render(data);
        retryButtonEl?.focus();
      }
    },

    hide(): void {
      visible = false;
      if (rootEl) {
        rootEl.style.display = 'none';
      }
    },

    setRetryEnabled(enabled: boolean): void {
      if (!retryButtonEl) return;
      retryButtonEl.disabled = !enabled;
      retryButtonEl.textContent = enabled ? 'Riprova' : 'Sincronizzazione profilo...';
      retryButtonEl.style.opacity = enabled ? '1' : '0.55';
      retryButtonEl.style.cursor = enabled ? 'pointer' : 'wait';
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
      retryButtonEl = null;
      causeEl = null;
      fragmentsEl = null;
      statsEl = null;
      leaderboardEl = null;
      shareEl = null;
      visible = false;
    },
  };

  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'death-overlay';
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background:
        radial-gradient(ellipse at 50% 40%, rgba(42, 28, 12, 0.55) 0%, rgba(8, 6, 5, 0.96) 70%),
        repeating-linear-gradient(
          0deg,
          rgba(60, 40, 18, 0.04) 0px,
          rgba(60, 40, 18, 0.04) 1px,
          transparent 1px,
          transparent 4px
        );
      z-index: 110; display: flex; align-items: center; justify-content: center;
      font-family: Cinzel, 'Palatino Linotype', 'Book Antiqua', serif; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    const content = document.createElement('div');
    contentEl = content;
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'death-title');
    content.style.cssText = `
      background: linear-gradient(165deg, #2A1E12 0%, #1A1510 45%, #14100C 100%);
      border: 2px solid #8C6A28; border-radius: 2px;
      box-shadow: inset 0 0 0 1px #3A2A14, 0 12px 40px rgba(0,0,0,0.55);
      padding: 28px 32px; width: min(460px, 92vw);
      display: flex; flex-direction: column; gap: 14px;
      pointer-events: all;
    `;

    const title = document.createElement('h2');
    title.id = 'death-title';
    title.textContent = 'La Cripta Ti Ha Spezzato';
    title.style.cssText = `
      margin: 0; font-size: 24px; color: #E8C070; letter-spacing: 0.04em;
      border-bottom: 1px solid #5A4020; padding-bottom: 12px;
    `;
    content.appendChild(title);

    const glyphRule = document.createElement('div');
    glyphRule.setAttribute('aria-hidden', 'true');
    glyphRule.textContent = '𓂀  ·  𓋹  ·  𓆣';
    glyphRule.style.cssText = `
      color: #8C6A28; font-size: 14px; letter-spacing: 0.35em;
      text-align: center; margin-top: -4px;
    `;
    content.appendChild(glyphRule);

    causeEl = document.createElement('div');
    causeEl.style.cssText = 'color:#C77D3A; font-size:14px; line-height:1.5;';
    content.appendChild(causeEl);

    fragmentsEl = document.createElement('div');
    fragmentsEl.style.cssText = 'color:#2E8B8B; font-size:12px; line-height:1.4;';
    content.appendChild(fragmentsEl);

    // Run summary (v2): piani, nemici, oro — chiude il loop roguelike
    statsEl = document.createElement('div');
    statsEl.style.cssText = `
      margin-top: 2px; padding-top: 12px; border-top: 1px solid #3A2A1A;
      color: #C8B89A; font-size: 13px; line-height: 1.8;
      display: flex; flex-direction: column; gap: 2px;
    `;
    content.appendChild(statsEl);

    // C-01: classifica locale (top 3 run) nella schermata di morte.
    leaderboardEl = document.createElement('div');
    leaderboardEl.style.cssText = `
      margin-top: 2px; padding-top: 12px; border-top: 1px solid #3A2A1A;
      color: #A89070; font-size: 12px; line-height: 1.7;
      display: flex; flex-direction: column; gap: 2px;
    `;
    content.appendChild(leaderboardEl);

    const note = document.createElement('div');
    note.style.cssText = 'color:#8B7355; font-size:12px; line-height:1.5;';
    note.textContent = 'Il retry si abilita quando il profilo e stato sincronizzato.';
    content.appendChild(note);

    // C-01: condivisione del seed (URL riproducibile ?seed=N).
    shareEl = document.createElement('button');
    shareEl.type = 'button';
    shareEl.textContent = '🔗 Condividi questo seed';
    shareEl.style.cssText = `
      align-self: flex-start; padding: 8px 14px; background: transparent;
      border: 1px solid #2E8B8B; color: #2E8B8B;
      font-family: Cinzel, 'Palatino Linotype', serif; font-size: 12px;
      border-radius: 2px; cursor: pointer;
    `;
    const shareButton = shareEl;
    shareEl.addEventListener('click', () => {
      const url = shareButton.dataset.shareUrl ?? '';
      if (url.length === 0) return;
      void copyShareUrl(url, shareButton);
    });
    content.appendChild(shareEl);

    retryButtonEl = document.createElement('button');
    retryButtonEl.type = 'button';
    retryButtonEl.textContent = 'Riprova';
    retryButtonEl.style.cssText = `
      align-self: flex-end; padding: 10px 18px; background: transparent;
      border: 1px solid #D4A05A; color: #E8C070;
      font-family: Cinzel, 'Palatino Linotype', serif; font-size: 13px;
      border-radius: 2px; letter-spacing: 0.06em;
    `;
    retryButtonEl.addEventListener('click', () => {
      if (!retryButtonEl?.disabled) {
        overlay.onRetry?.();
      }
    });
    content.appendChild(retryButtonEl);

    panel.appendChild(content);
    return panel;
  }

  // C-01: copia l'URL negli appunti (clipboard API, fallback prompt manuale).
  async function copyShareUrl(url: string, button: HTMLButtonElement): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = '✓ Seed copiato negli appunti';
    } catch {
      // Fallback: prompt con URL preselezionato (nessuna execCommand deprecata).
      const fallback = window.prompt('Copia manualmente il seed:', url);
      if (fallback === null) {
        return;
      }
      button.textContent = '✓ URL mostrato';
    }
    setTimeout(() => {
      button.textContent = '🔗 Condividi questo seed';
    }, 2500);
  }

  function formatDuration(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    return minutes > 0
      ? `${minutes}m ${seconds.toString().padStart(2, '0')}s`
      : `${seconds}s`;
  }

  function render(data: DeathOverlayData): void {
    if (!causeEl || !fragmentsEl || !statsEl) return;

    causeEl.textContent = `Causa: ${data.cause}.`;

    if (data.isPersonalRecord) {
      causeEl.innerHTML =
        `<span style="background:#3A1A00; border:1px solid #D4A05A; color:#D4A05A;
          padding:2px 8px; border-radius:2px; font-size:11px; margin-right:8px;">✦ RECORD PERSONALE</span>` +
        `Causa: ${data.cause}.`;
    }

    if (data.fragments === null) {
      fragmentsEl.textContent = 'Frammenti di Ka: profilo non disponibile.';
    } else {
      const kaThisRun = data.kaEarnedThisRun > 0
        ? ` <span style="color:#D4A05A;">(+${data.kaEarnedThisRun} questa run)</span>`
        : '';
      fragmentsEl.innerHTML = `☥ Ka totale: <b>${data.fragments}</b>${kaThisRun}`;
    }

    const durationText = data.runDurationMs > 0
      ? `<div>⏱ Durata: <b>${formatDuration(data.runDurationMs)}</b></div>`
      : '';

    statsEl.innerHTML = `
      <div>🏺 Piani percorsi: <b>${data.floorsCleared}</b></div>
      <div>⚔️ Nemici abbattuti: <b>${data.enemiesDefeated}</b></div>
      <div>🪙 Oro raccolto: <b>${data.goldEarned}</b></div>
      ${durationText}
    `;

    if (leaderboardEl) {
      const board = data.leaderboard ?? [];
      if (board.length === 0) {
        leaderboardEl.textContent = 'Classifica locale: nessuna run registrata.';
      } else {
        leaderboardEl.innerHTML =
          '<div style="color:#D4A05A; margin-bottom:2px;">🏆 Classifica locale</div>' +
          board
            .slice(0, 3)
            .map((entry, index) => {
              const isCurrent = index === 0 && data.isPersonalRecord;
              const style = isCurrent
                ? ' style="color:#D4A05A; font-weight:bold;"'
                : '';
              return `<div${style}>${index + 1}. Piani <b>${entry.floorReached}</b> · 🪙 ${entry.goldEarned} · ⚔️ ${entry.enemiesDefeated}</div>`;
            })
            .join('');
      }
    }

    if (shareEl) {
      if (data.shareUrl !== undefined && data.shareUrl.length > 0) {
        shareEl.style.display = '';
        shareEl.dataset.shareUrl = data.shareUrl;
      } else {
        shareEl.style.display = 'none';
      }
    }
    overlay.setRetryEnabled(data.canRetry);
  }

  return overlay;
}
