import { resolveUiAccessibilityPalette } from '@/config/AccessibilityPalette.js';
import { ALL_UPGRADES } from '@/content/upgrades.js';

// C-04: fucina visuale — emoji e rarità per gli innesti scoperti.
const GRAFT_EMOJI: Readonly<Record<string, string>> = {
  'Bronzo del Nilo': '🛡️',
  'Osso di Sciacallo': '🐺',
  "Resina d'Ambra": '🟡',
  'Lapislazzuli': '🔷',
  'Occhio di Horus': '👁️',
};
const GRAFT_RARITY: Readonly<Record<string, string>> = {
  'Bronzo del Nilo': '#C8B89A',
  'Osso di Sciacallo': '#6EE0D1',
  "Resina d'Ambra": '#C8B89A',
  'Lapislazzuli': '#7B8CFF',
  'Occhio di Horus': '#FFB45E',
};
const GRAFT_DEFAULT_EMOJI = '⚒️';
const GRAFT_DEFAULT_RARITY = '#C8B89A';

function graftDefinitionByName(name: string): { readonly name: string; readonly description: string } | null {
  for (const upgrade of ALL_UPGRADES) {
    if (upgrade.name === name) {
      return upgrade;
    }
  }
  return null;
}

export interface ProgressionOverlayMapRoom {
  readonly roomId: number;
  readonly role: string;
  readonly revealed: boolean;
  readonly isEntry: boolean;
  readonly isExit: boolean;
  readonly isTarget: boolean;
}

export interface ProgressionOverlayKaNode {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly cost: number;
  readonly maxLevel: number;
  readonly currentLevel: number;
  readonly affordable: boolean;
  readonly status: string;
}

export interface ProgressionOverlayBestiaryEntry {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
}

export interface ProgressionOverlayData {
  readonly floorId: string;
  readonly floorSummary: string;
  readonly fragments: number;
  readonly bestiaryEntries: readonly ProgressionOverlayBestiaryEntry[];
  readonly discoveredGrafts: readonly string[];
  readonly revealedRoomCount: number;
  readonly rooms: readonly ProgressionOverlayMapRoom[];
  readonly kaNodes: readonly ProgressionOverlayKaNode[];
}

export interface ProgressionOverlay {
  show(data: ProgressionOverlayData): void;
  refresh(data: ProgressionOverlayData): void;
  hide(): void;
  readonly visible: boolean;
  onClose: (() => void) | null;
  onPurchaseNode: ((nodeId: string) => void) | null;
  applyPresentation(settings: {
    readonly textScale: number;
    readonly highContrast: boolean;
    readonly colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  }): void;
  mount(container: HTMLElement): void;
  dispose(): void;
}

export function createProgressionOverlay(): ProgressionOverlay {
  let rootEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let mapSectionEl: HTMLElement | null = null;
  let bestiarySectionEl: HTMLElement | null = null;
  let graftSectionEl: HTMLElement | null = null;
  let kaSectionEl: HTMLElement | null = null;
  let headerEl: HTMLElement | null = null;
  let isVisible = false;
  let lastFocusedElement: HTMLElement | null = null;

  const overlay: ProgressionOverlay = {
    onClose: null,
    onPurchaseNode: null,

    get visible(): boolean {
      return isVisible;
    },

    show(data: ProgressionOverlayData): void {
      isVisible = true;
      if (rootEl) {
        lastFocusedElement =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        rootEl.style.display = 'flex';
        render(data);
        focusFirstInteractiveElement();
      }
    },

    refresh(data: ProgressionOverlayData): void {
      if (rootEl && isVisible) {
        render(data);
      }
    },

    hide(): void {
      isVisible = false;
      if (rootEl) {
        rootEl.style.display = 'none';
      }
      lastFocusedElement?.focus();
      lastFocusedElement = null;
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
      mapSectionEl = null;
      bestiarySectionEl = null;
      graftSectionEl = null;
      kaSectionEl = null;
      headerEl = null;
      isVisible = false;
    },
  };

  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'progression-overlay';
    panel.tabIndex = -1;
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(11, 9, 8, 0.92);
      z-index: 90; display: flex; align-items: center; justify-content: center;
      font-family: 'Courier New', monospace; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    const content = document.createElement('div');
    contentEl = content;
    content.id = 'progression-content';
    content.tabIndex = -1;
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'progression-title');
    content.style.cssText = `
      background: #1A1512; border: 2px solid #4A2F1A; border-radius: 6px;
      padding: 28px 30px; max-width: 920px; width: 92%; max-height: 88vh;
      overflow-y: auto; pointer-events: all;
      display: grid; grid-template-columns: 1.1fr 1fr; gap: 18px;
    `;

    headerEl = document.createElement('div');
    headerEl.style.cssText = 'grid-column: 1 / -1;';
    content.appendChild(headerEl);

    mapSectionEl = document.createElement('section');
    bestiarySectionEl = document.createElement('section');
    graftSectionEl = document.createElement('section');
    kaSectionEl = document.createElement('section');

    mapSectionEl.style.cssText = sectionStyle();
    bestiarySectionEl.style.cssText = sectionStyle();
    graftSectionEl.style.cssText = sectionStyle();
    kaSectionEl.style.cssText = sectionStyle();
    kaSectionEl.style.gridColumn = '1 / -1';

    content.appendChild(mapSectionEl);
    content.appendChild(bestiarySectionEl);
    content.appendChild(graftSectionEl);
    content.appendChild(kaSectionEl);

    const footer = document.createElement('div');
    footer.style.cssText = `
      grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-top: 8px;
      border-top: 1px solid #4A2F1A; padding-top: 16px;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Chiudi';
    closeBtn.style.cssText = buttonStyle('#D4A05A');
    closeBtn.addEventListener('click', () => {
      overlay.onClose?.();
    });
    footer.appendChild(closeBtn);
    content.appendChild(footer);

    panel.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        overlay.onClose?.();
      }
    });

    panel.appendChild(content);
    return panel;
  }

  function render(data: ProgressionOverlayData): void {
    if (!headerEl || !mapSectionEl || !bestiarySectionEl || !graftSectionEl || !kaSectionEl) {
      return;
    }

    headerEl.innerHTML = `
      <h2 id="progression-title" style="margin:0 0 8px; font-size:24px; color:#D4A05A;">
        Cronaca della Necropoli
      </h2>
      <div style="color:#2E8B8B; font-size:13px; line-height:1.5;">
        ${escapeHtml(data.floorId)} · ${escapeHtml(data.floorSummary)}
      </div>
      <div style="color:#C77D3A; font-size:14px; margin-top:8px;">
        Frammenti di Ka: ${data.fragments} · Stanze rivelate: ${data.revealedRoomCount}
      </div>
    `;

    mapSectionEl.innerHTML = `
      <h3 style="${sectionTitleStyle()}">Mappa del Piano</h3>
      <div style="font-size:12px; color:#8B7355; margin-bottom:8px;">
        Le stanze rivelate dai bracieri compaiono come CONOSCIUTE.
      </div>
      ${data.rooms.map((room) => {
        const badges = [
          room.isEntry ? 'INGRESSO' : null,
          room.isExit ? 'USCITA' : null,
          room.isTarget ? 'TARGET' : null,
          room.revealed ? 'CONOSCIUTA' : 'OSCURA',
        ].filter((value): value is string => value !== null);
        return `
          <div style="${rowStyle()}">
            <div style="color:#D4A05A;">Stanza ${room.roomId} · ${escapeHtml(room.role)}</div>
            <div style="color:#8B7355; font-size:11px;">${badges.join(' · ')}</div>
          </div>
        `;
      }).join('')}
    `;

    bestiarySectionEl.innerHTML = `
      <h3 style="${sectionTitleStyle()}">Bestiario</h3>
      <div style="font-size:12px; color:#8B7355; margin-bottom:8px;">
        Entry sbloccate: ${data.bestiaryEntries.length}
      </div>
      ${
        data.bestiaryEntries.length === 0
          ? '<div style="color:#8B7355; font-size:12px;">Nessuna creatura catalogata.</div>'
          : data.bestiaryEntries.map((entry) => `
              <div style="${rowStyle()}">
                <div style="color:#D4A05A; font-size:13px;">${escapeHtml(entry.name)}</div>
                <div style="color:#8B7355; font-size:11px; line-height:1.4; margin-top:4px;">
                  ${escapeHtml(entry.summary)}
                </div>
              </div>
            `).join('')
      }
    `;

    graftSectionEl.innerHTML = `
      <h3 style="${sectionTitleStyle()}">Fucina — Innesti / Graft</h3>
      ${
        data.discoveredGrafts.length === 0
          ? '<div style="color:#8B7355; font-size:12px;">Nessun innesto scoperto. Scava i siti di sabbia per trovarne di rari.</div>'
          : data.discoveredGrafts.map((name) => {
              const definition = graftDefinitionByName(name);
              const emoji = GRAFT_EMOJI[name] ?? GRAFT_DEFAULT_EMOJI;
              const rarity = GRAFT_RARITY[name] ?? GRAFT_DEFAULT_RARITY;
              return `
              <div style="${rowStyle()} display:flex; gap:10px; align-items:flex-start;">
                <div style="font-size:22px; line-height:1.2;">${emoji}</div>
                <div style="flex:1;">
                  <div style="color:${rarity}; font-size:14px;">${escapeHtml(name)}</div>
                  <div style="color:#8B7355; font-size:11px; line-height:1.4; margin-top:3px;">
                    ${definition === null ? '' : escapeHtml(definition.description)}
                  </div>
                </div>
              </div>`;
            }).join('')
      }
    `;

    kaSectionEl.innerHTML = `
      <h3 style="${sectionTitleStyle()}">Albero del Ka</h3>
      <div style="font-size:12px; color:#8B7355; margin-bottom:10px;">
        Acquista nodi permanenti con i Frammenti raccolti.
      </div>
      ${data.kaNodes.map((node) => `
        <div style="${rowStyle()} display:flex; justify-content:space-between; gap:16px; align-items:flex-start;">
          <div style="flex:1;">
            <div style="color:#D4A05A; font-size:14px;">${escapeHtml(node.name)}</div>
            <div style="color:#8B7355; font-size:11px; line-height:1.4; margin-top:4px;">
              ${escapeHtml(node.description)}
            </div>
            <div style="color:#2E8B8B; font-size:11px; margin-top:6px;">
              Costo ${node.cost} · Livello ${node.currentLevel}/${node.maxLevel}
            </div>
            <div style="color:#C77D3A; font-size:11px; margin-top:4px;">
              ${escapeHtml(node.status)}
            </div>
          </div>
          <button
            type="button"
            data-ka-node-id="${escapeAttribute(node.id)}"
            ${node.affordable ? '' : 'disabled'}
            style="${buttonStyle(node.affordable ? '#D4A05A' : '#6A5840')}"
          >
            ${node.currentLevel >= node.maxLevel ? 'Completato' : 'Acquista'}
          </button>
        </div>
      `).join('')}
    `;

    for (const button of kaSectionEl.querySelectorAll<HTMLButtonElement>('button[data-ka-node-id]')) {
      button.addEventListener('click', () => {
        const nodeId = button.dataset.kaNodeId;
        if (!nodeId) return;
        overlay.onPurchaseNode?.(nodeId);
      });
    }
  }

  function focusFirstInteractiveElement(): void {
    const button = rootEl?.querySelector<HTMLElement>('button:not([disabled])');
    button?.focus();
  }

  return overlay;
}

function sectionStyle(): string {
  return `
    background: rgba(11, 9, 8, 0.45);
    border: 1px solid #4A2F1A;
    border-radius: 4px;
    padding: 14px;
  `;
}

function sectionTitleStyle(): string {
  return 'margin:0 0 8px; color:#D4A05A; font-size:16px;';
}

function rowStyle(): string {
  return `
    border-top: 1px solid rgba(74, 47, 26, 0.45);
    padding: 8px 0;
  `;
}

function buttonStyle(color: string): string {
  return `
    padding: 8px 16px; background: transparent; border: 1px solid ${color};
    color: ${color}; font-family: 'Courier New', monospace; font-size: 12px;
    cursor: pointer; border-radius: 3px; min-width: 110px;
  `;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
