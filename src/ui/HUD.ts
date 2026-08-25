/**
 * Scopo: HUD DOM-based che mostra HP, combustibile torcia, arma corrente
 *        e una minimappa schematica runtime.
 * Ownership: GameApplication crea il contenitore HUD.
 * Vincolo: usa DOM/CSS (non canvas) come richiesto da GDD §17.
 *
 * Design:
 *   - Il contenitore HUD è un div posizionato sopra il canvas.
 *   - Ogni elemento è un div con classi CSS per lo styling.
 *   - I valori vengono aggiornati tramite metodi espliciti (nessun polling interno).
 *   - La minimappa è resa come SVG schematica dentro un contenitore DOM.
 */

import { resolveUiAccessibilityPalette } from '@/config/AccessibilityPalette.js';
import type { RuntimeMinimapState } from '@/app/RuntimeMinimap.js';

export interface HUDState {
  /** Punti vita correnti. */
  hp: number;
  /** Punti vita massimi. */
  maxHp: number;
  /** Carburante torcia rimanente in secondi. */
  torchFuelSeconds: number;
  /** Capacità massima torcia in secondi. */
  torchCapacitySeconds: number;
  /** La torcia è accesa? */
  torchLit: boolean;
  /** La torcia è piazzata? */
  torchPlaced: boolean;
  /** Livello di oscurità (0-100). */
  darkness: number;
  /** Nome dell'arma corrente. */
  weaponName: string;
  /** Arma slot 1, 2, 3 disponibile? */
  weaponSlots: readonly (string | null)[];
  /** Slot arma corrente (0-based). */
  currentWeaponSlot: number;
  /** Obiettivo attivo del vertical slice. */
  objectiveText: string;
  /** Stato sintetico del target/uscita. */
  progressText: string;
  /** Riga descrittiva del piano corrente. */
  floorText: string;
  /** View-model della minimappa. */
  minimap: RuntimeMinimapState | null;
  /**
   * Chip minaccia in alto a destra (sotto minimappa): nemici vivi con HP.
   * Vuoto se nessun nemico attivo.
   */
  threats: readonly HUDThreatChip[];
}

/** Chip nemico per la striscia threat HUD. */
export interface HUDThreatChip {
  readonly label: string;
  readonly kind: 'guardian' | 'mummy' | 'scarab' | 'generic';
  readonly awake: boolean;
  readonly hpRatio: number;
}

export interface HUD {
  /** Aggiorna tutti i valori dell'HUD. */
  update(state: Partial<HUDState>): void;

  /** Applica variazioni visuali dell HUD a runtime. */
  applyPresentation(settings: {
    readonly textScale: number;
    readonly highContrast: boolean;
    readonly colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
    readonly showDarknessBar: boolean;
    readonly soundIndicator: boolean;
    readonly staticCrosshair: boolean;
  }): void;

  /** Mostra un messaggio temporaneo (es. "Torcia spenta!"). */
  showMessage(text: string, durationMs?: number, direction?: SubtitleDirection | null): void;

  // C-03: infrastruttura sottotitoli — barra dedicata con frecce direzione.
  /** Mostra una riga di sottotitolo (barra separata, aria-live). */
  showSubtitle(text: string, options?: SubtitleOptions): void;
  /** Attiva/disattiva i sottotitoli (impostazioni accessibilità). */
  setSubtitlePreferences(prefs: { readonly names: boolean; readonly directions: boolean }): void;

  /**
   * Hint contestuale (tutorial graduale): piccola didascalia in basso che
   * appare UNA SOLA volta per id nella run (Hades-style: il gioco insegna
   * quando l'azione diventa rilevante). Se un hint è già visibile, gli
   * altri vengono accodati e mostrati in sequenza.
   */
  showContextualHint(hint: ContextualHint): void;

  /** Mostra un indicatore sonoro accessibile in forma testuale. */
  showSoundIndicator(text: string, durationMs?: number): void;

  /**
   * G-18 V3 (v2): hitmarker differenziale — oro = colpo, rosso = critico,
   * grigio = mancato. Colore applicato alle due barre dell'X.
   */
  showHitmarker(kind?: 'hit' | 'crit' | 'miss'): void;

  /** NEW-2: crosshair dinamica — spread 0..1 (sprint/salto espande, crouch stringe). */
  setCrosshairSpread(spread: number): void;

  /** Mostra la schermata tutorial dei comandi. */
  showTutorial(): void;

  /** Nasconde il tutorial se visibile. */
  hideTutorial(): void;

  /** Callback chiamata quando il tutorial viene chiuso dall'utente. */
  onTutorialDismiss: (() => void) | null;

  /** Mostra/nasconde l'intera HUD. */
  setVisible(visible: boolean): void;

  /**
   * Aggiorna la barra HP del boss (mostrata in alto al centro).
   * Passa null per nascondere la barra.
   */
  updateBossBar(data: {
    readonly name: string;
    readonly hp: number;
    readonly maxHp: number;
    readonly phase: string;
  } | null): void;

  /** Crea l'elemento DOM. Da chiamare dopo aver aggiunto il container al DOM. */
  mount(container: HTMLElement): void;

  /** Rimuove tutto dal DOM. */
  dispose(): void;
}

// ── Tipi pubblici ────────────────────────────────────────────────────────

/** Hint contestuale: appare una volta sola per id (tutorial graduale). */
export interface ContextualHint {
  readonly id: string;
  readonly text: string;
  readonly durationMs?: number;
}

// C-03: infrastruttura sottotitoli.
/** Direzione della sorgente sonora rispetto al player (bussola). */
export type SubtitleDirection = 'front' | 'back' | 'left' | 'right';

export interface SubtitleOptions {
  readonly durationMs?: number;
  /** Nome del parlante/evento (mostrato solo con subtitleNames). */
  readonly speaker?: string;
  /** Direzione (mostrata solo con subtitleDirections). */
  readonly direction?: SubtitleDirection | null;
}

const DIRECTION_ARROWS: Readonly<Record<SubtitleDirection, string>> = {
  front: '⬆',
  back: '⬇',
  left: '⬅',
  right: '➡',
};

// ── Implementazione ──────────────────────────────────────────────────────

export function createHUD(): HUD {
  let rootEl: HTMLElement | null = null;
  let hpFillEl: HTMLElement | null = null;
  let hpTextEl: HTMLElement | null = null;
  let torchFillEl: HTMLElement | null = null;
  let torchTextEl: HTMLElement | null = null;
  let darknessEl: HTMLElement | null = null;
  let weaponNameEl: HTMLElement | null = null;
  let weaponSlotsEl: HTMLElement | null = null;
  let minimapEl: HTMLElement | null = null;
  let threatStripEl: HTMLElement | null = null;
  let messageEl: HTMLElement | null = null;
  let soundIndicatorEl: HTMLElement | null = null;
  let hitmarkerEl: HTMLElement | null = null;
  let hitmarkerTimer: ReturnType<typeof setTimeout> | null = null;
  let crosshairEl: HTMLElement | null = null;
  // C-03: barra sottotitoli (accessibilità — subtitleNames/subtitleDirections).
  let subtitleEl: HTMLElement | null = null;
  let subtitleTimer: ReturnType<typeof setTimeout> | null = null;
  let subtitlePrefs: { readonly names: boolean; readonly directions: boolean } = {
    names: false,
    directions: false,
  };
  // NEW-2: le 4 linee della crosshair (top/bottom/left/right) per spread dinamico
  let crosshairLines: readonly HTMLElement[] = [];
  let objectiveEl: HTMLElement | null = null;
  let progressEl: HTMLElement | null = null;
  let floorEl: HTMLElement | null = null;
  let bossBarContainerEl: HTMLElement | null = null;
  let bossBarFillEl: HTMLElement | null = null;
  let bossBarNameEl: HTMLElement | null = null;
  let bossBarPhaseEl: HTMLElement | null = null;
  let messageTimer: ReturnType<typeof setTimeout> | null = null;
  let soundIndicatorTimer: ReturnType<typeof setTimeout> | null = null;
  let tutorialFocusTimer: ReturnType<typeof setTimeout> | null = null;
  let tutorialEl: HTMLElement | null = null;
  let tutorialDismissBtn: HTMLButtonElement | null = null;
  let lastFocusedElement: HTMLElement | null = null;
  let _onTutorialDismiss: (() => void) | null = null;
  let soundIndicatorEnabled = false;
  // Hint contestuali (tutorial graduale): coda + dedupe per id.
  let hintEl: HTMLElement | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | null = null;
  let hintFadeTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingHints: ContextualHint[] = [];
  const shownHintIds = new Set<string>();

  let state: HUDState = {
    hp: 100,
    maxHp: 100,
    torchFuelSeconds: 180,
    torchCapacitySeconds: 180,
    torchLit: false,
    torchPlaced: false,
    darkness: 0,
    weaponName: 'Pugni',
    weaponSlots: ['Pugni', null, null],
    currentWeaponSlot: 0,
    objectiveText: 'Esplora la necropoli',
    progressText: 'Nessuna minaccia tracciata',
    floorText: 'Piano non inizializzato',
    minimap: null,
    threats: [],
  };

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function localShowTutorial(): void {
    if (!tutorialEl) return;
    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    tutorialEl.style.display = 'flex';
    tutorialEl.setAttribute('aria-hidden', 'false');
    tutorialDismissBtn?.focus();
    if (tutorialFocusTimer) {
      clearTimeout(tutorialFocusTimer);
    }
    tutorialFocusTimer = setTimeout(() => {
      tutorialDismissBtn?.focus();
      tutorialFocusTimer = null;
    }, 0);
  }

  function localHideTutorial(): void {
    if (!tutorialEl) return;
    if (tutorialFocusTimer) {
      clearTimeout(tutorialFocusTimer);
      tutorialFocusTimer = null;
    }
    tutorialEl.style.display = 'none';
    tutorialEl.setAttribute('aria-hidden', 'true');
    lastFocusedElement?.focus();
    lastFocusedElement = null;
    // Notifica il callback di dismiss
    if (typeof _onTutorialDismiss === 'function') _onTutorialDismiss();
  }

  function trapTutorialFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !tutorialDismissBtn) {
      return;
    }

    event.preventDefault();
    tutorialDismissBtn.focus();
  }

  // ── Hint contestuali (tutorial graduale) ──
  // Creazione lazy dell'elemento (solo al primo hint): nessun costo se il
  // tutorial graduale non viene mai usato.
  function ensureHintEl(): HTMLElement | null {
    if (hintEl || !rootEl) return hintEl;
    hintEl = document.createElement('div');
    hintEl.id = 'contextual-hint';
    hintEl.setAttribute('aria-hidden', 'true');
    hintEl.setAttribute('aria-live', 'polite');
    hintEl.style.cssText = `
      position: absolute; left: 50%; bottom: 64px; transform: translateX(-50%);
      z-index: 12; pointer-events: none; text-align: center;
      background: rgba(11, 9, 8, 0.88); border: 1px solid #4A2F1A;
      border-left: 3px solid #D4A05A; border-radius: 3px;
      color: #E8D5B0; font-family: 'Courier New', monospace;
      font-size: 13px; padding: 8px 16px; max-width: 72%;
      opacity: 0; transition: opacity 0.25s ease;
    `;
    rootEl.appendChild(hintEl);
    return hintEl;
  }

  function flushNextHint(): void {
    const hint = pendingHints.shift();
    if (!hint) return;
    const el = ensureHintEl();
    if (!el) return;
    el.textContent = hint.text;
    el.style.opacity = '1';
    el.setAttribute('aria-hidden', 'false');
    hintTimer = setTimeout(() => {
      el.style.opacity = '0';
      el.setAttribute('aria-hidden', 'true');
      hintTimer = null;
      hintFadeTimer = setTimeout(() => {
        hintFadeTimer = null;
        flushNextHint();
      }, 300);
    }, hint.durationMs ?? 4000);
  }

  function localShowContextualHint(hint: ContextualHint): void {
    // Una sola volta per id nella run (tutorial graduale, non ripetitivo).
    if (shownHintIds.has(hint.id)) return;
    shownHintIds.add(hint.id);
    pendingHints.push(hint);
    if (hintTimer === null && hintFadeTimer === null) {
      flushNextHint();
    }
  }

  // C-03: barra sottotitoli — testo + freccia direzione + speaker opzionale.
  // Gated da subtitlePrefs.names: senza l'opzione la barra non appare mai.
  function localShowSubtitle(text: string, options: SubtitleOptions = {}): void {
    if (!subtitlePrefs.names) return;
    if (!subtitleEl) return;
    if (subtitleTimer) {
      clearTimeout(subtitleTimer);
    }
    const parts: string[] = [];
    if (subtitlePrefs.directions && options.direction) {
      parts.push(DIRECTION_ARROWS[options.direction]);
    }
    if (options.speaker !== undefined) {
      parts.push(`«${options.speaker}»`);
    }
    parts.push(text);
    subtitleEl.textContent = parts.filter((part) => part.length > 0).join(' ');
    subtitleEl.style.display = 'block';
    subtitleEl.style.opacity = '1';

    subtitleTimer = setTimeout(() => {
      if (subtitleEl) {
        subtitleEl.style.opacity = '0';
      }
      subtitleTimer = null;
    }, options.durationMs ?? 2500);
  }

  function buildDOM(): HTMLElement {
    const root = document.createElement('div');
    root.id = 'game-hud';
    root.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 10;
      font-family: 'Courier New', monospace; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    // ── Barra HP (in basso a sinistra) ──
    const hpContainer = document.createElement('div');
    hpContainer.style.cssText = `
      position: absolute; bottom: 32px; left: 32px;
      display: flex; align-items: center; gap: 8px;
    `;

    const hpLabel = document.createElement('span');
    hpLabel.textContent = 'HP';
    hpLabel.style.cssText = 'font-size: 14px; color: #8B4513;';

    const hpBar = document.createElement('div');
    hpBar.style.cssText = `
      width: 200px; height: 18px; background: #1A1A1A;
      border: 1px solid #4A2F1A; border-radius: 2px;
      overflow: hidden; position: relative;
    `;

    hpFillEl = document.createElement('div');
    hpFillEl.style.cssText = `
      height: 100%; width: 100%; background: linear-gradient(90deg, #6A334D, #9A2B2B);
      transition: width 0.15s ease-out;
    `;
    hpBar.appendChild(hpFillEl);

    hpTextEl = document.createElement('span');
    hpTextEl.style.cssText = `
      font-size: 12px; color: #D4A05A; min-width: 50px; text-align: right;
    `;
    hpTextEl.textContent = '100/100';

    hpContainer.appendChild(hpLabel);
    hpContainer.appendChild(hpBar);
    hpContainer.appendChild(hpTextEl);
    root.appendChild(hpContainer);

    // ── Carburante torcia (sotto HP) ──
    const torchContainer = document.createElement('div');
    torchContainer.style.cssText = `
      position: absolute; bottom: 8px; left: 32px;
      display: flex; align-items: center; gap: 8px;
    `;

    const torchLabel = document.createElement('span');
    torchLabel.textContent = '🔥';
    torchLabel.style.cssText = 'font-size: 14px;';

    const torchBar = document.createElement('div');
    torchBar.style.cssText = `
      width: 200px; height: 10px; background: #1A1A1A;
      border: 1px solid #4A2F1A; border-radius: 2px;
      overflow: hidden; position: relative;
    `;

    torchFillEl = document.createElement('div');
    torchFillEl.style.cssText = `
      height: 100%; width: 100%; background: linear-gradient(90deg, #D4A05A, #FF8C00);
      transition: width 0.3s ease-out;
    `;
    torchBar.appendChild(torchFillEl);

    torchTextEl = document.createElement('span');
    torchTextEl.style.cssText = `
      font-size: 11px; color: #D4A05A; min-width: 40px; text-align: right;
    `;
    torchTextEl.textContent = '180s';

    torchContainer.appendChild(torchLabel);
    torchContainer.appendChild(torchBar);
    torchContainer.appendChild(torchTextEl);
    root.appendChild(torchContainer);

    // ── Obiettivo e stato run (in alto a sinistra) ──
    const objectivePanel = document.createElement('div');
    objectivePanel.style.cssText = `
      position: absolute; top: 16px; left: 16px;
      min-width: 280px; max-width: 420px;
      background: rgba(11, 9, 8, 0.84);
      border: 1px solid #4A2F1A; border-radius: 4px;
      padding: 12px 14px;
      display: flex; flex-direction: column; gap: 6px;
    `;

    const objectiveLabel = document.createElement('div');
    objectiveLabel.textContent = 'OBIETTIVO';
    objectiveLabel.style.cssText = `
      color: #8B7355; font-size: 11px; letter-spacing: 2px;
    `;

    objectiveEl = document.createElement('div');
    objectiveEl.style.cssText = `
      color: #D4A05A; font-size: 14px; line-height: 1.4;
    `;
    objectiveEl.textContent = state.objectiveText;

    progressEl = document.createElement('div');
    progressEl.style.cssText = `
      color: #C77D3A; font-size: 12px; line-height: 1.35;
    `;
    progressEl.textContent = state.progressText;

    floorEl = document.createElement('div');
    floorEl.style.cssText = `
      color: #2E8B8B; font-size: 11px; line-height: 1.35;
    `;
    floorEl.textContent = state.floorText;

    objectivePanel.appendChild(objectiveLabel);
    objectivePanel.appendChild(objectiveEl);
    objectivePanel.appendChild(progressEl);
    objectivePanel.appendChild(floorEl);
    root.appendChild(objectivePanel);

    // ── Oscurità (sotto torcia) ──
    darknessEl = document.createElement('div');
    darknessEl.style.cssText = `
      position: absolute; bottom: 56px; left: 32px;
      font-size: 11px; color: #2E8B8B;
    `;
    darknessEl.textContent = 'Oscurità: 0';
    root.appendChild(darknessEl);

    // ── Arma corrente (in basso a destra) ──
    const weaponContainer = document.createElement('div');
    weaponContainer.style.cssText = `
      position: absolute; bottom: 32px; right: 32px;
      display: flex; flex-direction: column; align-items: flex-end; gap: 4px;
    `;

    weaponNameEl = document.createElement('div');
    weaponNameEl.style.cssText = `
      font-size: 16px; color: #D4A05A; text-transform: uppercase;
      letter-spacing: 2px;
    `;
    weaponNameEl.textContent = 'PUGNI';

    weaponSlotsEl = document.createElement('div');
    weaponSlotsEl.style.cssText = `
      display: flex; gap: 8px; font-size: 12px; color: #8B7355;
    `;

    weaponContainer.appendChild(weaponNameEl);
    weaponContainer.appendChild(weaponSlotsEl);
    root.appendChild(weaponContainer);

    // ── Crosshair (centro) — visibile solo con staticCrosshair ──
    crosshairEl = document.createElement('div');
    crosshairEl.setAttribute('aria-hidden', 'true');
    crosshairEl.style.cssText = `
      position: absolute; left: 50%; top: 50%;
      width: 0; height: 0; opacity: 0; pointer-events: none; z-index: 12;
    `;
    crosshairEl.innerHTML = `
      <div class="ch-line ch-top" style="position:absolute;left:-1px;top:-8px;width:2px;height:7px;background:#D4A05A;opacity:.85;"></div>
      <div class="ch-line ch-bottom" style="position:absolute;left:-1px;top:1px;width:2px;height:7px;background:#D4A05A;opacity:.85;"></div>
      <div class="ch-line ch-left" style="position:absolute;left:-8px;top:-1px;width:7px;height:2px;background:#D4A05A;opacity:.85;"></div>
      <div class="ch-line ch-right" style="position:absolute;left:1px;top:-1px;width:7px;height:2px;background:#D4A05A;opacity:.85;"></div>
    `;
    crosshairLines = [
      crosshairEl.querySelector<HTMLElement>('.ch-top'),
      crosshairEl.querySelector<HTMLElement>('.ch-bottom'),
      crosshairEl.querySelector<HTMLElement>('.ch-left'),
      crosshairEl.querySelector<HTMLElement>('.ch-right'),
    ].filter((el): el is HTMLElement => el !== null);
    root.appendChild(crosshairEl);

    // ── Minimappa schematica (in alto a destra) ──
    minimapEl = document.createElement('div');
    minimapEl.style.cssText = `
      position: absolute; top: 16px; right: 16px;
      width: 140px; height: 140px; background: rgba(11, 9, 8, 0.85);
      border: 2px solid #4A2F1A; border-radius: 4px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; color: #4A2F1A; overflow: hidden;
    `;
    root.appendChild(minimapEl);

    // ── Threat strip (sotto minimappa): chip nemici vivi ──
    threatStripEl = document.createElement('div');
    threatStripEl.setAttribute('aria-label', 'Minacce vicine');
    threatStripEl.style.cssText = `
      position: absolute; top: 164px; right: 16px;
      width: 140px; display: flex; flex-direction: column; gap: 4px;
      pointer-events: none; z-index: 11;
    `;
    root.appendChild(threatStripEl);

    soundIndicatorEl = document.createElement('div');
    soundIndicatorEl.style.cssText = `
      position: absolute; top: 166px; right: 16px;
      max-width: 240px; padding: 8px 10px;
      background: rgba(11, 9, 8, 0.9);
      border: 1px solid #4A2F1A; border-radius: 4px;
      font-size: 11px; color: #D4A05A; line-height: 1.35;
      text-align: right; opacity: 0; transition: opacity 0.18s ease;
    `;
    root.appendChild(soundIndicatorEl);

    // G-18: hitmarker — X al centro, visibile solo ~90ms dopo un colpo a segno.
    hitmarkerEl = document.createElement('div');
    hitmarkerEl.setAttribute('aria-hidden', 'true');
    hitmarkerEl.style.cssText = `
      position: absolute; left: 50%; top: 50%;
      width: 22px; height: 22px;
      transform: translate(-50%, -50%) rotate(45deg);
      opacity: 0; pointer-events: none; z-index: 12;
    `;
    hitmarkerEl.innerHTML = `
      <div style="position:absolute;left:50%;top:0;width:3px;height:100%;margin-left:-1.5px;background:#FFF8E7;box-shadow:0 0 6px #D4A05A;"></div>
      <div style="position:absolute;top:50%;left:0;height:3px;width:100%;margin-top:-1.5px;background:#FFF8E7;box-shadow:0 0 6px #D4A05A;"></div>
    `;
    root.appendChild(hitmarkerEl);

    // ── Tutorial overlay ──
    tutorialEl = document.createElement('div');
    tutorialEl.id = 'game-tutorial';
    tutorialEl.setAttribute('role', 'dialog');
    tutorialEl.setAttribute('aria-modal', 'true');
    tutorialEl.setAttribute('aria-labelledby', 'tutorial-title');
    tutorialEl.setAttribute('aria-describedby', 'tutorial-body');
    tutorialEl.setAttribute('aria-hidden', 'true');
    tutorialEl.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      z-index: 20; pointer-events: all;
      display: flex; align-items: center; justify-content: center;
      background: rgba(11, 9, 8, 0.93);
      font-family: 'Courier New', monospace; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;
    tutorialEl.innerHTML = `
      <div id="tutorial-content" style="
        background: #1A1512; border: 2px solid #4A2F1A; border-radius: 6px;
        padding: 28px 36px; max-width: 560px; width: 90%;
        max-height: 85vh; overflow-y: auto;
      ">
        <h2 id="tutorial-title" style="color: #D4A05A; font-size: 20px; margin: 0 0 16px; text-align: center; border-bottom: 1px solid #4A2F1A; padding-bottom: 10px;">
          █ LA PIRAMIDE PERDUTA █
        </h2>
        <p style="color: #2E8B8B; font-size: 13px; margin-bottom: 16px; text-align: center;">
          Egyptian Noir Roguelike FPS
        </p>

        <div id="tutorial-body" style="color: #8B7355; font-size: 12px; line-height: 1.8;">
          <div style="color: #D4A05A; margin-bottom: 4px;">━ MOVIMENTO ━</div>
          <div><span style="color:#9A5A38;">W A S D</span> &nbsp;Cammina</div>
          <div><span style="color:#9A5A38;">MOUSE</span> &nbsp;Guarda intorno</div>
          <div><span style="color:#9A5A38;">SHIFT</span> &nbsp;Scatto</div>
          <div><span style="color:#9A5A38;">CTRL</span> &nbsp;Acquattati</div>
          <div><span style="color:#9A5A38;">SPAZIO</span> &nbsp;Salto / Schivata (design condiviso)</div>

          <div style="color: #D4A05A; margin: 10px 0 4px;">━ AZIONI ━</div>
          <div><span style="color:#9A5A38;">E</span> &nbsp;Interagisci</div>
          <div><span style="color:#9A5A38;">F</span> &nbsp;Accendi/Spegni torcia</div>
          <div><span style="color:#9A5A38;">G</span> &nbsp;Posa/Raccogli torcia</div>
          <div><span style="color:#9A5A38;">Q</span> &nbsp;Agita torcia</div>
          <div><span style="color:#9A5A38;">R</span> &nbsp;Eco del Ka</div>
          <div><span style="color:#9A5A38;">CLICK SX</span> &nbsp;Attacco</div>
          <div><span style="color:#9A5A38;">CLICK DX</span> &nbsp;Parata</div>

          <div style="color: #D4A05A; margin: 10px 0 4px;">━ ARMI / INTERFACCIA ━</div>
          <div><span style="color:#9A5A38;">1 2 3</span> &nbsp;Seleziona arma</div>
          <div><span style="color:#9A5A38;">TAB</span> &nbsp;Mappa</div>
          <div><span style="color:#9A5A38;">ESC</span> &nbsp;Pausa / Impostazioni</div>
          <div><span style="color:#9A5A38;">\`</span> &nbsp;Overlay debug</div>

          <div style="color: #D4A05A; margin: 10px 0 4px;">━ SIMBOLI SUL PAVIMENTO ━</div>
          <div><span style="color:#C89030;">▣ Forma dorata</span> &nbsp;= Pala raccoglibile (E) — ti serve per scavare</div>
          <div><span style="color:#808570;">▨ Zona sabbiosa</span> &nbsp;= Sito di scavo — tieni E con la pala per dissotterrare il tesoro</div>
          <div><span style="color:#8B7355; font-size:11px; margin-top:4px; display:block;">
            Attenzione: lo scavo fa rumore e attira i nemici. Tieni la torcia accesa!
          </span></div>
        </div>

        <div style="margin-top: 20px; text-align: center;">
          <button id="tutorial-dismiss" type="button" aria-label="Chiudi tutorial e inizia la partita" style="
            background: transparent; border: 1px solid #D4A05A;
            color: #D4A05A; font-family: 'Courier New', monospace;
            font-size: 14px; padding: 10px 32px; cursor: pointer;
            border-radius: 3px; letter-spacing: 2px;
          ">INIZIA LA PARTITA</button>
        </div>
      </div>
    `;

    // Dismiss button
    tutorialDismissBtn = tutorialEl.querySelector('#tutorial-dismiss');
    tutorialDismissBtn?.addEventListener('click', () => {
      localHideTutorial();
    });
    tutorialEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      localHideTutorial();
    });
    tutorialEl.addEventListener('keydown', trapTutorialFocus);
    // Clicco fuori dal pannello chiude
    tutorialEl.addEventListener('click', (e) => {
      if (e.target === tutorialEl) localHideTutorial();
    });

    root.appendChild(tutorialEl);
    tutorialEl.style.display = 'none';
    messageEl = document.createElement('div');
    messageEl.style.cssText = `
      position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      font-size: 24px; color: #D4A05A; text-align: center;
      opacity: 0; transition: opacity 0.3s ease;
      text-shadow: 0 0 10px rgba(0,0,0,0.8);
      pointer-events: none; z-index: 40; max-width: 80%; font-family: 'Cinzel', serif;
    `;
    root.appendChild(messageEl);

    // C-03: barra sottotitoli (accessibilità) — più grande e in basso,
    // con freccia di direzione opzionale.
    subtitleEl = document.createElement('div');
    subtitleEl.style.cssText = `
      position: absolute; bottom: 14%; left: 50%; transform: translate(-50%, 0);
      font-size: 20px; color: #F2E6CE; text-align: center; letter-spacing: 0.02em;
      opacity: 0; transition: opacity 0.3s ease;
      text-shadow: 0 1px 6px rgba(0,0,0,0.95); background: rgba(10,8,5,0.55);
      padding: 6px 18px; border-radius: 6px; border-left: 3px solid #6ee0d1;
      pointer-events: none; z-index: 42; max-width: 86%; font-family: 'Cinzel', serif;
    `;
    subtitleEl.setAttribute('aria-live', 'polite');
    subtitleEl.style.display = 'none';
    root.appendChild(subtitleEl);

    // ── Barra boss (in alto al centro) ──────────────────────────────────────
    bossBarContainerEl = document.createElement('div');
    bossBarContainerEl.style.cssText = `
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
      width: min(480px, 80vw); display: flex; flex-direction: column; align-items: center;
      gap: 4px; pointer-events: none; display: none;
    `;

    bossBarNameEl = document.createElement('div');
    bossBarNameEl.style.cssText = `
      font-size: 13px; color: #D4A05A; letter-spacing: 1px; text-align: center;
      font-family: 'Cinzel', 'Courier New', monospace;
      text-shadow: 0 0 8px rgba(0,0,0,0.9);
    `;

    const bossBarTrack = document.createElement('div');
    bossBarTrack.style.cssText = `
      width: 100%; height: 10px; background: #1a1008;
      border: 1px solid #8B3A00; border-radius: 2px; overflow: hidden;
    `;

    bossBarFillEl = document.createElement('div');
    bossBarFillEl.style.cssText = `
      height: 100%; width: 100%;
      background: linear-gradient(90deg, #8B1A1A, #C84A00);
      transition: width 0.2s ease-out;
    `;
    bossBarTrack.appendChild(bossBarFillEl);

    bossBarPhaseEl = document.createElement('div');
    bossBarPhaseEl.style.cssText = `
      font-size: 10px; color: #C77D3A; letter-spacing: 2px; text-align: center;
    `;

    bossBarContainerEl.appendChild(bossBarNameEl);
    bossBarContainerEl.appendChild(bossBarTrack);
    bossBarContainerEl.appendChild(bossBarPhaseEl);
    root.appendChild(bossBarContainerEl);

    return root;
  }

  function updateWeaponSlots(slots: readonly (string | null)[], current: number): void {
    if (!weaponSlotsEl) return;
    weaponSlotsEl.innerHTML = '';
    for (let i = 0; i < slots.length; i++) {
      const slotEl = document.createElement('span');
      const weaponName = slots[i];
      slotEl.textContent = `[${i + 1}] ${weaponName ?? 'vuoto'}`;
      if (i === current) {
        slotEl.style.cssText = 'color: #D4A05A; font-weight: bold;';
      }
      weaponSlotsEl.appendChild(slotEl);
    }
  }

  function renderThreatStrip(threats: readonly HUDThreatChip[]): void {
    if (!threatStripEl) return;
    if (threats.length === 0) {
      threatStripEl.innerHTML = '';
      if (soundIndicatorEl) soundIndicatorEl.style.top = '164px';
      return;
    }

    const kindColor: Record<HUDThreatChip['kind'], string> = {
      guardian: '#C77D3A',
      mummy: '#8B7355',
      scarab: '#2E8B6B',
      generic: '#9A5A38',
    };

    threatStripEl.innerHTML = threats.slice(0, 4).map((t) => {
      const pct = Math.round(Math.max(0, Math.min(1, t.hpRatio)) * 100);
      const accent = kindColor[t.kind];
      const opacity = t.awake ? '1' : '0.45';
      const pulse = t.awake ? 'box-shadow:0 0 4px rgba(200,120,40,0.35);' : '';
      return `<div style="
        display:flex;align-items:center;gap:6px;opacity:${opacity};
        background:rgba(11,9,8,0.88);border:1px solid #3A2A1A;border-radius:3px;
        padding:3px 6px;${pulse}
      ">
        <span style="
          width:8px;height:8px;border-radius:1px;background:${accent};flex-shrink:0;
        "></span>
        <span style="flex:1;font-size:10px;color:#C8B89A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${t.label}
        </span>
        <span style="
          width:36px;height:4px;background:#1A1512;border-radius:1px;overflow:hidden;flex-shrink:0;
        "><span style="display:block;height:100%;width:${pct}%;background:${accent};"></span></span>
      </div>`;
    }).join('');

    // Sposta l'indicatore sonoro sotto i chip.
    const stripH = Math.min(4, threats.length) * 22 + 8;
    if (soundIndicatorEl) soundIndicatorEl.style.top = `${164 + stripH}px`;
  }

  function renderMinimap(minimap: RuntimeMinimapState | null): void {
    if (!minimapEl) return;
    if (!minimap || minimap.rooms.length === 0) {
      minimapEl.innerHTML = '<span style="color:#4A2F1A;">MAPPA</span>';
      return;
    }

    const { visited, total } = minimap.exploredFraction;

    // Corridoi visibili come rettangoli sottili
    const corridorRects = minimap.corridors
      .filter((c) => c.visible)
      .map((c) => `
        <rect
          x="${c.x.toFixed(2)}"
          y="${c.y.toFixed(2)}"
          width="${c.width.toFixed(2)}"
          height="${c.height.toFixed(2)}"
          fill="#3A2810"
          fill-opacity="0.85"
        />
      `).join('');

    const visibleRooms = minimap.rooms.filter((room) => room.visible);
    const roomRects = visibleRooms.map((room) => {
      const fill =
        room.isPlayerRoom ? '#D4A05A'
        : room.isExit ? '#2E8B8B'
        : room.isMapRoom ? '#8B7355'
        : room.visited ? '#5A3F20'
        : '#4A2F1A';
      const stroke = room.isTargetRoom ? '#C77D3A' : room.isPlayerRoom ? '#F7C86A' : '#6B5030';
      const opacity = room.isPlayerRoom || room.isEntry || room.isExit || room.isMapRoom ? 0.95 : 0.78;
      return `
        <rect
          x="${room.x.toFixed(2)}"
          y="${room.y.toFixed(2)}"
          width="${room.width.toFixed(2)}"
          height="${room.height.toFixed(2)}"
          rx="1.5"
          ry="1.5"
          fill="${fill}"
          fill-opacity="${opacity}"
          stroke="${stroke}"
          stroke-width="${room.isTargetRoom ? 1.4 : 0.8}"
        />
      `;
    }).join('');

    const playerMarker = minimap.player
      ? `
        <circle
          cx="${minimap.player.x.toFixed(2)}"
          cy="${minimap.player.y.toFixed(2)}"
          r="2.2"
          fill="#F7E7B1"
          stroke="#1A1512"
          stroke-width="0.9"
        />
      `
      : '';

    // Nemici: rombo rosso se svegli (ti stanno cercando), contorno smorzato
    // se dormienti (puoi ancora sorprenderli). La forma li distingue dal
    // cerchio del giocatore anche per chi non separa bene i colori.
    const enemyMarkers = minimap.enemies.map((enemy) => {
      const x = enemy.x.toFixed(2);
      const y = enemy.y.toFixed(2);
      const fill = enemy.awake ? '#D0452A' : 'rgba(140, 70, 50, 0.55)';
      const stroke = enemy.awake ? '#FFD9A0' : '#6B4A3A';
      return `
        <g transform="translate(${x} ${y}) rotate(45)">
          <rect
            x="-1.9" y="-1.9" width="3.8" height="3.8"
            fill="${fill}"
            stroke="${stroke}"
            stroke-width="0.8"
          />
        </g>
      `;
    }).join('');

    // Contatore esplorazione in basso
    const exploredLabel = `
      <text
        x="50"
        y="97"
        text-anchor="middle"
        font-size="6"
        fill="#8B7355"
        font-family="'Courier New', monospace"
      >${visited}/${total}</text>
    `;

    minimapEl.innerHTML = `
      <svg viewBox="0 0 100 100" width="100%" height="100%" aria-label="Minimappa runtime">
        <rect x="0" y="0" width="100" height="100" fill="rgba(11, 9, 8, 0.88)" />
        ${corridorRects}
        ${roomRects}
        ${enemyMarkers}
        ${playerMarker}
        ${exploredLabel}
      </svg>
    `;
  }

  return {
    get onTutorialDismiss(): (() => void) | null {
      return _onTutorialDismiss;
    },
    set onTutorialDismiss(fn: (() => void) | null) {
      _onTutorialDismiss = fn;
    },

    mount(container: HTMLElement): void {
      rootEl = buildDOM();
      container.appendChild(rootEl);
      // Applica lo stato iniziale
      updateWeaponSlots(state.weaponSlots, state.currentWeaponSlot);
    },

    update(partial: Partial<HUDState>): void {
      state = { ...state, ...partial };

      // HP
      if (hpFillEl) {
        const hpPct = clamp((state.hp / state.maxHp) * 100, 0, 100);
        hpFillEl.style.width = `${hpPct}%`;

        // Cambia colore in base alla percentuale
        if (hpPct <= 25) {
          hpFillEl.style.background = 'linear-gradient(90deg, #6A334D, #8B1A1A)';
        } else if (hpPct <= 50) {
          hpFillEl.style.background = 'linear-gradient(90deg, #9A5A38, #9A2B2B)';
        } else {
          hpFillEl.style.background = 'linear-gradient(90deg, #6A334D, #9A2B2B)';
        }
      }
      if (hpTextEl) {
        hpTextEl.textContent = `${state.hp}/${state.maxHp}`;
      }

      // Torcia
      if (torchFillEl) {
        const torchPct = clamp(
          (state.torchFuelSeconds / state.torchCapacitySeconds) * 100,
          0,
          100,
        );
        torchFillEl.style.width = `${torchPct}%`;

        if (!state.torchLit) {
          torchFillEl.style.background = 'linear-gradient(90deg, #444, #333)';
        } else if (state.torchPlaced) {
          torchFillEl.style.background = 'linear-gradient(90deg, #D4A05A, #C77D3A)';
        } else if (torchPct <= 20) {
          torchFillEl.style.background = 'linear-gradient(90deg, #8B1A1A, #FF4500)';
        } else {
          torchFillEl.style.background = 'linear-gradient(90deg, #D4A05A, #FF8C00)';
        }
      }
      if (torchTextEl) {
        torchTextEl.textContent = `${Math.round(state.torchFuelSeconds)}s${state.torchPlaced ? ' · POSATA' : ''}`;
      }

      // Oscurità
      if (darknessEl) {
        const level =
          state.darkness >= 75 ? 'TESTIMONE' :
          state.darkness >= 50 ? 'PATTUGLIE' :
          state.darkness >= 25 ? 'SUSSURRI' :
          'CALMA';
        darknessEl.textContent = `Oscurità: ${state.darkness} (${level})`;
      }

      // Arma
      if (weaponNameEl) {
        weaponNameEl.textContent = state.weaponName.toUpperCase();
      }

      if (objectiveEl) {
        objectiveEl.textContent = state.objectiveText;
      }
      if (progressEl) {
        progressEl.textContent = state.progressText;
      }
      if (floorEl) {
        floorEl.textContent = state.floorText;
      }

      updateWeaponSlots(state.weaponSlots, state.currentWeaponSlot);
      renderMinimap(state.minimap);
      renderThreatStrip(state.threats);
    },

    applyPresentation(settings): void {
      const palette = resolveUiAccessibilityPalette(
        settings.colorBlindMode,
        settings.highContrast,
      );
      soundIndicatorEnabled = settings.soundIndicator;
      if (rootEl) {
        rootEl.style.fontSize = `${settings.textScale}em`;
        rootEl.style.color = palette.textColor;
      }
      if (darknessEl) {
        darknessEl.style.display = settings.showDarknessBar ? 'block' : 'none';
        darknessEl.style.color = palette.accentColor;
      }
      if (minimapEl) {
        minimapEl.style.borderColor = palette.borderColor;
        minimapEl.style.color = palette.minimapColor;
      }
      if (soundIndicatorEl) {
        soundIndicatorEl.style.display = settings.soundIndicator ? 'block' : 'none';
        soundIndicatorEl.style.borderColor = palette.borderColor;
        soundIndicatorEl.style.color = palette.textColor;
      }
      // G-18: crosshair statica al centro (aiuto mira, opzione accessibilità)
      if (crosshairEl) {
        crosshairEl.style.opacity = settings.staticCrosshair ? '1' : '0';
      }
    },

    showMessage(text: string, durationMs = 2500, direction: SubtitleDirection | null = null): void {
      // C-03: con i sottotitoli attivi e una direzione, il testo vive nella
      // barra sottotitoli (in basso, accessibile) invece del centro schermo —
      // niente doppioni visivi né strict-mode violation per i selettori.
      if (subtitlePrefs.names && direction !== null) {
        localShowSubtitle(text, { durationMs, direction });
        return;
      }
      if (!messageEl) return;
      if (messageTimer) {
        clearTimeout(messageTimer);
      }

      messageEl.textContent = text;
      messageEl.style.opacity = '1';

      messageTimer = setTimeout(() => {
        if (messageEl) {
          messageEl.style.opacity = '0';
        }
        messageTimer = null;
      }, durationMs);
    },

    // C-03: infrastruttura sottotitoli (barra dedicata + frecce direzione).
    showSubtitle(text: string, options: SubtitleOptions = {}): void {
      localShowSubtitle(text, options);
    },

    setSubtitlePreferences(prefs: { readonly names: boolean; readonly directions: boolean }): void {
      subtitlePrefs = { names: prefs.names, directions: prefs.directions };
      if (!subtitlePrefs.names && subtitleEl) {
        subtitleEl.style.opacity = '0';
      }
    },

    showContextualHint(hint: ContextualHint): void {
      localShowContextualHint(hint);
    },

    showSoundIndicator(text: string, durationMs = 1800): void {
      if (!soundIndicatorEnabled || !soundIndicatorEl) return;
      if (soundIndicatorTimer) {
        clearTimeout(soundIndicatorTimer);
      }
      soundIndicatorEl.textContent = text;
      soundIndicatorEl.style.opacity = '1';
      soundIndicatorTimer = setTimeout(() => {
        if (soundIndicatorEl) {
          soundIndicatorEl.style.opacity = '0';
        }
        soundIndicatorTimer = null;
      }, durationMs);
    },

    showHitmarker(kind: 'hit' | 'crit' | 'miss' = 'hit'): void {
      if (!hitmarkerEl) return;
      if (hitmarkerTimer) {
        clearTimeout(hitmarkerTimer);
      }
      // v2: colore differenziale — oro colpo, rosso critico, grigio mancato
      const color = kind === 'crit' ? '#E85D3A'
        : kind === 'miss' ? '#9A9A8A'
          : '#FFD48A';
      const glow = kind === 'crit' ? '#E85D3A' : '#D4A05A';
      hitmarkerEl.querySelectorAll('div').forEach((bar) => {
        bar.style.background = color;
        bar.style.boxShadow = `0 0 6px ${glow}`;
      });
      hitmarkerEl.style.opacity = '1';
      hitmarkerTimer = setTimeout(() => {
        if (hitmarkerEl) {
          hitmarkerEl.style.opacity = '0';
        }
        hitmarkerTimer = null;
      }, 90);
    },

    setCrosshairSpread(spread: number): void {
      // NEW-2: sposta le 4 linee dal centro — spread 0 (chiusa, crouch/fermo)
      // a 1 (aperta, sprint/salto). La distanza base è 8px, max ~20px.
      const clamped = Math.max(0, Math.min(1, spread));
      const offset = 8 + clamped * 12;
      const [top, bottom, left, right] = crosshairLines;
      if (top) top.style.top = `${-offset}px`;
      if (bottom) bottom.style.top = `${offset - 7}px`;
      if (left) left.style.left = `${-offset}px`;
      if (right) right.style.left = `${offset - 7}px`;
    },

    showTutorial(): void {
      localShowTutorial();
    },

    hideTutorial(): void {
      localHideTutorial();
    },

    setVisible(visible: boolean): void {
      if (rootEl) {
        rootEl.style.display = visible ? '' : 'none';
      }
    },

    updateBossBar(data): void {
      if (!bossBarContainerEl) return;
      if (data === null) {
        bossBarContainerEl.style.display = 'none';
        return;
      }
      bossBarContainerEl.style.display = 'flex';
      if (bossBarNameEl) bossBarNameEl.textContent = data.name.toUpperCase();
      if (bossBarFillEl) {
        const pct = Math.max(0, Math.min(100, (data.hp / data.maxHp) * 100));
        bossBarFillEl.style.width = `${pct}%`;
        if (pct <= 20) {
          bossBarFillEl.style.background = 'linear-gradient(90deg, #4A0000, #FF2200)';
        } else {
          bossBarFillEl.style.background = 'linear-gradient(90deg, #8B1A1A, #C84A00)';
        }
      }
      if (bossBarPhaseEl) {
        const phaseLabel: Record<string, string> = {
          INTRO: 'INTRO', PHASE_1: 'FASE I', PHASE_2: 'FASE II',
          ENRAGE: '⚠ FURIA', DEFEATED: 'SCONFITTO',
        };
        bossBarPhaseEl.textContent = phaseLabel[data.phase] ?? data.phase;
      }
    },

    dispose(): void {
      if (messageTimer) {
        clearTimeout(messageTimer);
        messageTimer = null;
      }
      if (subtitleTimer) {
        clearTimeout(subtitleTimer);
        subtitleTimer = null;
      }
      if (soundIndicatorTimer) {
        clearTimeout(soundIndicatorTimer);
        soundIndicatorTimer = null;
      }
      if (hitmarkerTimer) {
        clearTimeout(hitmarkerTimer);
        hitmarkerTimer = null;
      }
      if (tutorialFocusTimer) {
        clearTimeout(tutorialFocusTimer);
        tutorialFocusTimer = null;
      }
      if (hintTimer) {
        clearTimeout(hintTimer);
        hintTimer = null;
      }
      if (hintFadeTimer) {
        clearTimeout(hintFadeTimer);
        hintFadeTimer = null;
      }
      pendingHints = [];
      shownHintIds.clear();
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootEl = null;
      hpFillEl = null;
      hpTextEl = null;
      torchFillEl = null;
      torchTextEl = null;
      darknessEl = null;
      weaponNameEl = null;
      weaponSlotsEl = null;
      minimapEl = null;
      threatStripEl = null;
      messageEl = null;
      soundIndicatorEl = null;
      hitmarkerEl = null;
      objectiveEl = null;
      progressEl = null;
      floorEl = null;
      tutorialEl = null;
      tutorialDismissBtn = null;
      hintEl = null;
      lastFocusedElement = null;
      bossBarContainerEl = null;
      bossBarFillEl = null;
      bossBarNameEl = null;
      bossBarPhaseEl = null;
    },
  };
}
