/**
 * Scopo: menu principale del gioco, mostrato all'avvio prima di iniziare una run.
 * Ownership: GameApplication lo crea e lo mostra in bootstrap.
 * Vincolo: usa DOM/CSS per coerenza con il resto dell'HUD (nessun framework UI).
 *
 * Il menu sostituisce l'ingresso diretto in partita (gap G-09): l'utente sceglie
 * di iniziare una nuova run, aprire le impostazioni o la progressione persistente
 * prima che il loop di gioco parta davvero.
 */

import { resolveUiAccessibilityPalette } from '@/config/AccessibilityPalette.js';
import { isDailyMode, parseSeedParam, dailySeedFor } from '@/app/createGame.js';
import { generateInscription } from '@/content/inscriptions.js';

export interface MainMenuState {
  /** Frammenti di Ka del profilo (mostrati se disponibili). */
  readonly fragments: number | null;
  /** Piramidi sbloccate (per la selezione futura dell'hub). */
  readonly pyramidsUnlocked: number;
  /** Voci del bestiario sbloccate. */
  readonly bestiaryEntries: number;
}

export interface MainMenu {
  show(state: MainMenuState): void;
  hide(): void;
  readonly visible: boolean;
  onStartRun: (() => void) | null;
  onOpenSettings: (() => void) | null;
  onOpenProgression: (() => void) | null;
  /** C-02: probe WebXR — l'utente chiede di provare la modalità VR. */
  onVrRequest: (() => void) | null;
  applyPresentation(settings: {
    readonly textScale: number;
    readonly highContrast: boolean;
    readonly colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  }): void;
  mount(container: HTMLElement): void;
  dispose(): void;
}

export function createMainMenu(): MainMenu {
  let rootEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let fragmentsEl: HTMLElement | null = null;
  let progressEl: HTMLElement | null = null;
  let visible = false;

  const menu: MainMenu = {
    onStartRun: null,
    onVrRequest: null,
    onOpenSettings: null,
    onOpenProgression: null,

    get visible(): boolean {
      return visible;
    },

    show(state: MainMenuState): void {
      visible = true;
      if (rootEl) {
        rootEl.style.display = 'flex';
        if (fragmentsEl) {
          fragmentsEl.textContent =
            state.fragments === null
              ? 'Profilo non disponibile: la progressione non verra salvata.'
              : `Frammenti di Ka: ${state.fragments}`;
        }
        if (progressEl) {
          progressEl.textContent =
            state.bestiaryEntries > 0
              ? `Piramidi sbloccate: ${state.pyramidsUnlocked} · Bestiario: ${state.bestiaryEntries} voci`
              : 'Nessuna progressione persistente: questa run scrivera la prima pagina del papiro.';
        }
      }
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
      fragmentsEl = null;
      progressEl = null;
      visible = false;
    },
  };

  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'main-menu';
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(11, 9, 8, 0.97);
      z-index: 85; display: flex; align-items: center; justify-content: center;
      font-family: var(--font-title, 'Cinzel', Georgia, serif); color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    const content = document.createElement('div');
    contentEl = content;
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'main-menu-title');
    content.style.cssText = `
      background: #1A1512; border: 2px solid #4A2F1A; border-radius: 6px;
      padding: 32px 40px; width: min(480px, 92vw);
      display: flex; flex-direction: column; gap: 12px;
      pointer-events: all; text-align: center;
    `;

    const title = document.createElement('h1');
    title.id = 'main-menu-title';
    // FONT-1: geroglifici autentici come decorazione del titolo (Noto Egyptian)
    title.innerHTML = '<span class="hieroglyph" aria-hidden="true">𓂀 𓋹 𓆣</span><br>LA PIRAMIDE PERDUTA';
    title.style.cssText = `
      margin: 0; font-size: 26px; color: #D4A05A; letter-spacing: 2px; line-height: 1.6;
    `;
    content.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Egyptian Noir Roguelike FPS — Vertical Slice';
    subtitle.style.cssText = 'color: #2E8B8B; font-size: 12px; margin-bottom: 8px;';
    content.appendChild(subtitle);

    // v2: iscrizione geroglifica generativa per run (deterministica dal seed)
    // ?seed=N → seed esplicito; ?daily → seed del giorno; altrimenti nessuna.
    const urlSeed = parseSeedParam(window.location.search)
      ?? (isDailyMode(window.location.search) ? dailySeedFor(new Date()) : null);
    if (urlSeed !== null) {
      const inscription = generateInscription(urlSeed);
      const inscriptionEl = document.createElement('div');
      inscriptionEl.setAttribute('aria-hidden', 'true');
      inscriptionEl.innerHTML = `
        <div class="hieroglyph" style="color:#2E8B8B; font-size:15px; letter-spacing:3px; margin: 6px 0 2px;">
          ${inscription.glyphs}
        </div>
        <div style="color:#6B5135; font-size:10px; font-style:italic; margin-bottom: 6px;">
          ${inscription.preamble}
        </div>
      `;
      content.appendChild(inscriptionEl);
    }

    const startButton = buildButton('▶ INIZIA LA DISCESA');
    startButton.addEventListener('click', () => {
      menu.onStartRun?.();
    });
    content.appendChild(startButton);

    const settingsButton = buildButton('Impostazioni di accessibilita');
    settingsButton.addEventListener('click', () => {
      menu.onOpenSettings?.();
    });
    content.appendChild(settingsButton);

    const progressionButton = buildButton('Progressione del Ka (TAB)');
    progressionButton.addEventListener('click', () => {
      menu.onOpenProgression?.();
    });
    content.appendChild(progressionButton);

    progressEl = document.createElement('div');
    progressEl.style.cssText = 'color: #8B7355; font-size: 11px; line-height: 1.5;';
    content.appendChild(progressEl);

    fragmentsEl = document.createElement('div');
    fragmentsEl.style.cssText = 'color: #2E8B8B; font-size: 12px; margin-top: 4px;';
    content.appendChild(fragmentsEl);

    const note = document.createElement('div');
    note.textContent = 'La luce rivela. Il buio ricorda.';
    note.style.cssText = 'color: #4A2F1A; font-size: 11px; margin-top: 10px;';
    content.appendChild(note);

    // DAILY-1: badge "Tomba del Giorno" — stesso seed per tutti ogni 24h
    if (isDailyMode(window.location.search)) {
      const dailyBadge = document.createElement('div');
      dailyBadge.textContent = '𓆣 TOMBA DEL GIORNO — stessa cripta per tutti oggi';
      dailyBadge.style.cssText = `
        color: #2E8B8B; font-size: 10px; margin-top: 8px;
        letter-spacing: 1px; border: 1px solid #2E8B8B33;
        padding: 4px 10px; border-radius: 20px; display: inline-block;
      `;
      content.appendChild(dailyBadge);
    }

    // Attribuzione asset CC-BY/CC0 (richiesta dalle licenze) — vedi CREDITS.md
    const credits = document.createElement('div');
    credits.textContent = 'Modelli: Polygonal Mind (CC0) · Poly by Google, D. Yamamoto (CC-BY) · Texture: ambientCG (CC0)';
    credits.style.cssText = 'color: #3A2A1A; font-size: 9px; margin-top: 8px; line-height: 1.4;';
    content.appendChild(credits);

    // C-02: probe WebXR — bottone sperimentale visibile solo se il browser
    // espone l'API (senza headset il probe comunica l'esito in modo onesto).
    if (typeof navigator !== 'undefined' && 'xr' in navigator) {
      const vrButton = buildButton('🥽 VR (sperimentale)');
      vrButton.style.marginTop = '10px';
      vrButton.style.fontSize = '11px';
      vrButton.style.borderColor = '#2E8B8B55';
      vrButton.addEventListener('click', () => {
        menu.onVrRequest?.();
      });
      content.appendChild(vrButton);
    }

    panel.appendChild(content);
    return panel;
  }

  function buildButton(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = `
      padding: 12px 16px; background: transparent;
      border: 1px solid #4A2F1A; color: #D4A05A;
      font-family: inherit; font-size: 14px;
      border-radius: 3px; cursor: pointer; transition: border-color 0.15s;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.borderColor = '#D4A05A';
    });
    button.addEventListener('mouseleave', () => {
      button.style.borderColor = '#4A2F1A';
    });
    return button;
  }

  return menu;
}
