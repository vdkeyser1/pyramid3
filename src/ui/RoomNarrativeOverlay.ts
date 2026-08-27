/**
 * Scopo: RoomNarrativeOverlay — interfaccia testuale per la presentazione dello scenario e dei segreti.
 *        Visualizza il titolo della camera, la descrizione archeologica e gli indizi con estetica faraonica.
 * Ownership: UI (puro DOM).
 */

import type { RoomNarrativeEntry } from '@/gameplay/RoomNarrativeDirector.js';

export interface RoomNarrativeOverlay {
  readonly root: HTMLElement;
  show(entry: RoomNarrativeEntry, durationMs?: number): void;
  showSecretDiscovery(secretName: string, description: string): void;
  hide(): void;
  dispose(): void;
}

export function createRoomNarrativeOverlay(container = document.body): RoomNarrativeOverlay {
  const root = document.createElement('div');
  root.id = 'room-narrative-overlay';
  root.style.position = 'fixed';
  root.style.bottom = '48px';
  root.style.left = '50%';
  root.style.transform = 'translateX(-50%)';
  root.style.zIndex = '90';
  root.style.maxWidth = '640px';
  root.style.width = '90%';
  root.style.padding = '16px 24px';
  root.style.background = 'linear-gradient(180deg, rgba(20, 15, 10, 0.92) 0%, rgba(10, 8, 5, 0.96) 100%)';
  root.style.border = '1px solid rgba(212, 162, 54, 0.45)';
  root.style.borderTop = '2px solid #d4a236';
  root.style.borderRadius = '4px';
  root.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.8), 0 0 20px rgba(212, 162, 54, 0.15)';
  root.style.color = '#e8d8b8';
  root.style.fontFamily = '"Cinzel", "Georgia", "Times New Roman", serif';
  root.style.pointerEvents = 'none';
  root.style.opacity = '0';
  root.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
  root.style.textAlign = 'center';

  const titleEl = document.createElement('div');
  titleEl.style.fontSize = '1.15rem';
  titleEl.style.fontWeight = 'bold';
  titleEl.style.color = '#f5c342';
  titleEl.style.letterSpacing = '0.08em';
  titleEl.style.marginBottom = '6px';
  titleEl.style.textTransform = 'uppercase';
  root.appendChild(titleEl);

  const descEl = document.createElement('div');
  descEl.style.fontSize = '0.92rem';
  descEl.style.lineHeight = '1.45';
  descEl.style.color = '#dfcfb2';
  descEl.style.marginBottom = '8px';
  root.appendChild(descEl);

  const clueEl = document.createElement('div');
  clueEl.style.fontSize = '0.82rem';
  clueEl.style.fontStyle = 'italic';
  clueEl.style.color = '#cfa036';
  clueEl.style.borderTop = '1px dashed rgba(212, 162, 54, 0.25)';
  clueEl.style.paddingTop = '6px';
  root.appendChild(clueEl);

  container.appendChild(root);

  let hideTimer: number | null = null;

  function show(entry: RoomNarrativeEntry, durationMs = 5500): void {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    titleEl.textContent = entry.title;
    descEl.textContent = entry.description;
    clueEl.textContent = `🔍 ${entry.atmosphericClue}`;

    root.style.opacity = '1';
    root.style.transform = 'translateX(-50%) translateY(0)';

    hideTimer = window.setTimeout(() => {
      hide();
    }, durationMs);
  }

  function showSecretDiscovery(secretName: string, description: string): void {
    if (hideTimer) {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    titleEl.textContent = `🏺 SEGRETO ARCHEOLOGICO: ${secretName}`;
    descEl.textContent = description;
    clueEl.textContent = '✨ Hai svelato una camera celata sotto il monumento!';

    root.style.opacity = '1';
    root.style.transform = 'translateX(-50%) translateY(0)';

    hideTimer = window.setTimeout(() => {
      hide();
    }, 6000);
  }

  function hide(): void {
    root.style.opacity = '0';
    root.style.transform = 'translateX(-50%) translateY(12px)';
  }

  function dispose(): void {
    if (hideTimer) window.clearTimeout(hideTimer);
    root.remove();
  }

  return {
    root,
    show,
    showSecretDiscovery,
    hide,
    dispose,
  };
}
