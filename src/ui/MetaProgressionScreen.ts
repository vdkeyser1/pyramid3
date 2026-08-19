/**
 * Schermata di meta-progressione permanente — 12 upgrade in 3 colonne.
 *
 * Scopo: visualizzare e acquistare i 12 upgrade permanenti gestiti da
 *        MetaProgressionStore (IndexedDB). Separata da ProgressionOverlay che
 *        gestisce i nodi Ka della run corrente.
 * Ownership: GameApplication la monta e la mostra tramite mainMenu.onOpenMetaProg.
 */

import type { MetaProgressionState, MetaProgressionStore } from '@/meta/MetaProgressionStore.js';
import {
  UPGRADE_DEFS,
  UPGRADE_IDS_BY_CATEGORY,
  upgradeCost,
  type UpgradeCategory,
  type UpgradeId,
} from '@/meta/MetaUpgradeDefinitions.js';

// ── Interfacce ────────────────────────────────────────────────────────────────

export interface MetaProgressionScreen {
  show(): Promise<void>;
  hide(): void;
  readonly visible: boolean;
  onClose: (() => void) | null;
  mount(container: HTMLElement): void;
  dispose(): void;
}

// ── Costanti visive ───────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  COMBAT:      '⚔ Combattimento',
  EXPLORATION: '🏺 Esplorazione',
  UTILITY:     '☥ Utilità',
};

const CATEGORY_COLORS: Record<UpgradeCategory, string> = {
  COMBAT:      '#8B1A1A',
  EXPLORATION: '#2E6B5A',
  UTILITY:     '#5A3A1A',
};

// ── Implementazione ───────────────────────────────────────────────────────────

export function createMetaProgressionScreen(store: MetaProgressionStore): MetaProgressionScreen {
  let rootEl: HTMLElement | null = null;
  let kaBalanceEl: HTMLElement | null = null;
  let gridEl: HTMLElement | null = null;
  let visible = false;
  let currentState: MetaProgressionState | null = null;

  const screen: MetaProgressionScreen = {
    onClose: null,

    get visible(): boolean {
      return visible;
    },

    async show(): Promise<void> {
      if (!rootEl) return;
      currentState = await store.load();
      renderContent();
      rootEl.style.display = 'flex';
      visible = true;
    },

    hide(): void {
      visible = false;
      if (rootEl) rootEl.style.display = 'none';
    },

    mount(container: HTMLElement): void {
      rootEl = buildShell();
      rootEl.style.display = 'none';
      container.appendChild(rootEl);
    },

    dispose(): void {
      if (rootEl?.parentNode) rootEl.parentNode.removeChild(rootEl);
      rootEl = null;
      kaBalanceEl = null;
      gridEl = null;
      visible = false;
    },
  };

  // ── Costruzione DOM fisso (shell) ─────────────────────────────────────────

  function buildShell(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'meta-progression-screen';
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(10, 8, 6, 0.96); z-index: 95;
      display: flex; align-items: center; justify-content: center;
      font-family: 'Courier New', monospace; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    const content = document.createElement('div');
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'meta-prog-title');
    content.style.cssText = `
      background: #130F0B; border: 2px solid #4A2F1A; border-radius: 6px;
      padding: 24px 28px; width: min(900px, 96vw); max-height: 90vh;
      display: flex; flex-direction: column; gap: 16px;
      pointer-events: all; overflow: hidden;
    `;

    // Intestazione
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid #4A2F1A; padding-bottom: 12px;
    `;

    const title = document.createElement('h2');
    title.id = 'meta-prog-title';
    title.innerHTML = '𓋹 SANTUARIO DEL KA — Upgrade Permanenti';
    title.style.cssText = 'margin: 0; font-size: 18px; color: #D4A05A; letter-spacing: 1px;';
    header.appendChild(title);

    kaBalanceEl = document.createElement('div');
    kaBalanceEl.style.cssText = 'font-size: 14px; color: #2E8B8B; font-weight: bold;';
    kaBalanceEl.textContent = '☥ Ka: —';
    header.appendChild(kaBalanceEl);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕ Chiudi';
    closeBtn.style.cssText = `
      padding: 6px 14px; background: transparent;
      border: 1px solid #4A2F1A; color: #8B7355;
      font-family: inherit; font-size: 12px; border-radius: 3px; cursor: pointer;
      margin-left: 16px;
    `;
    closeBtn.addEventListener('click', () => {
      screen.hide();
      screen.onClose?.();
    });
    header.appendChild(closeBtn);
    content.appendChild(header);

    // Nota
    const note = document.createElement('div');
    note.style.cssText = 'font-size: 11px; color: #6B5135; line-height: 1.5;';
    note.textContent =
      'Gli upgrade del Santuario sono permanenti: persistono tra le run e si applicano all\'inizio di ogni discesa. Spendi i Frammenti di Ka sapientemente.';
    content.appendChild(note);

    // Griglia upgrade (riempita da renderContent)
    gridEl = document.createElement('div');
    gridEl.style.cssText = `
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
      overflow-y: auto; flex: 1; padding-right: 4px;
    `;
    content.appendChild(gridEl);

    panel.appendChild(content);

    // Chiudi con Escape
    panel.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') { screen.hide(); screen.onClose?.(); }
    });

    return panel;
  }

  // ── Rendering dinamico (si ricalcola dopo ogni acquisto) ──────────────────

  function renderContent(): void {
    if (!gridEl || !currentState) return;
    gridEl.innerHTML = '';

    if (kaBalanceEl) {
      kaBalanceEl.textContent = `☥ Ka: ${currentState.kaFragments}`;
    }

    const categories: UpgradeCategory[] = ['COMBAT', 'EXPLORATION', 'UTILITY'];
    for (const cat of categories) {
      const col = document.createElement('div');
      col.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

      const catHeader = document.createElement('div');
      catHeader.style.cssText = `
        font-size: 12px; color: ${CATEGORY_COLORS[cat]}; letter-spacing: 2px;
        border-bottom: 1px solid ${CATEGORY_COLORS[cat]}44; padding-bottom: 6px;
        margin-bottom: 2px;
      `;
      catHeader.textContent = CATEGORY_LABELS[cat];
      col.appendChild(catHeader);

      for (const id of UPGRADE_IDS_BY_CATEGORY[cat]) {
        col.appendChild(buildUpgradeCard(id));
      }

      gridEl.appendChild(col);
    }
  }

  function buildUpgradeCard(id: UpgradeId): HTMLElement {
    // Copia locale: dentro la callback di some() il narrowing su `currentState`
    // (variabile di closure mutabile) andrebbe perso, richiedendo un `!`.
    const stateSnapshot = currentState;
    if (!stateSnapshot) return document.createElement('div');

    const def = UPGRADE_DEFS[id];
    const level = stateSnapshot.upgradeLevels[id] ?? 0;
    const isMaxed = level >= def.maxLevel;
    const cost = isMaxed ? 0 : upgradeCost(id, level);
    const canAfford = !isMaxed && stateSnapshot.kaFragments >= cost;

    // Check dependency requirements
    const depsUnmet = def.requires
      ? def.requires.some((reqId) => (stateSnapshot.upgradeLevels[reqId] ?? 0) < 1)
      : false;
    const canPurchase = canAfford && !depsUnmet;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #1A1410; border: 1px solid ${isMaxed ? '#4A7020' : depsUnmet ? '#2A1A0A' : '#4A2F1A'};
      border-radius: 4px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 6px;
      opacity: ${depsUnmet ? '0.55' : '1'};
    `;

    // Barra livello
    const levelRow = document.createElement('div');
    levelRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = `font-size: 12px; color: ${isMaxed ? '#7FBA40' : '#D4A05A'}; font-weight: bold;`;
    nameEl.textContent = def.name;
    levelRow.appendChild(nameEl);

    const levelEl = document.createElement('span');
    levelEl.style.cssText = 'font-size: 10px; color: #8B7355;';
    levelEl.textContent = isMaxed ? `MAX (${def.maxLevel})` : `${level}/${def.maxLevel}`;
    levelRow.appendChild(levelEl);
    card.appendChild(levelRow);

    // Barra visiva livello
    const barTrack = document.createElement('div');
    barTrack.style.cssText = `
      height: 4px; background: #2A1A0A; border-radius: 2px; overflow: hidden;
    `;
    const barFill = document.createElement('div');
    const fillPct = def.maxLevel > 0 ? (level / def.maxLevel) * 100 : 0;
    barFill.style.cssText = `
      height: 100%; width: ${fillPct}%; border-radius: 2px;
      background: ${isMaxed ? '#4A7020' : '#8B5A20'};
      transition: width 0.3s ease;
    `;
    barTrack.appendChild(barFill);
    card.appendChild(barTrack);

    // Descrizione
    const descEl = document.createElement('div');
    descEl.style.cssText = 'font-size: 10px; color: #7A6848; line-height: 1.4;';
    descEl.textContent = def.description;
    card.appendChild(descEl);

    // Dipendenze non soddisfatte
    if (depsUnmet && def.requires) {
      const reqEl = document.createElement('div');
      reqEl.style.cssText = 'font-size: 10px; color: #6A3010; font-style: italic;';
      const reqNames = def.requires.map((r) => UPGRADE_DEFS[r].name).join(', ');
      reqEl.textContent = `Richiede: ${reqNames}`;
      card.appendChild(reqEl);
    }

    // Pulsante acquisto
    if (!isMaxed) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.disabled = !canPurchase;
      btn.style.cssText = `
        margin-top: 2px; padding: 5px 10px; background: transparent;
        border: 1px solid ${canPurchase ? '#D4A05A' : '#3A2A1A'};
        color: ${canPurchase ? '#D4A05A' : '#5A4A3A'};
        font-family: inherit; font-size: 11px; border-radius: 3px;
        cursor: ${canPurchase ? 'pointer' : 'not-allowed'};
        transition: border-color 0.15s;
      `;
      btn.textContent = depsUnmet
        ? 'Bloccato'
        : canAfford
          ? `Acquista — ☥ ${cost}`
          : `☥ ${cost} (insufficiente)`;

      btn.addEventListener('click', () => {
        void handlePurchase(id);
      });
      card.appendChild(btn);
    } else {
      const maxedBadge = document.createElement('div');
      maxedBadge.style.cssText = 'font-size: 10px; color: #4A7020; letter-spacing: 1px;';
      maxedBadge.textContent = '✓ POTENZIAMENTO COMPLETO';
      card.appendChild(maxedBadge);
    }

    return card;
  }

  async function handlePurchase(id: UpgradeId): Promise<void> {
    const result = await store.purchaseUpgrade(id);
    if (result === null) return;
    currentState = result;
    renderContent();
  }

  return screen;
}
