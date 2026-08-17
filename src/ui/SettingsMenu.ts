/**
 * Scopo: pannello delle impostazioni di accessibilità, sovrapposto al gioco.
 * Ownership: GameApplication lo crea quando l'utente preme Esc → Impostazioni.
 * Vincolo: usa DOM/CSS per coerenza con il resto dell'HUD.
 *
 * Il pannello permette di modificare:
 *   - Luce assistita (assistedLight)
 *   - Telegrafi amplificati (amplifiedTelegraphs)
 *   - Alto contrasto (highContrast)
 *   - Modalità daltonismo (colorBlindMode)
 *   - Sottotitoli nomi (subtitleNames)
 *   - Sottotitoli direzioni (subtitleDirections)
 *   - Indicatore sonoro (soundIndicator)
 *   - Scala testo (textScale)
 *   - Sprint toggle (sprintToggle) — torchToggle rimosso (2026-08-16): F è già toggle nativo
 *   - Riduci vibrazione camera (reduceCameraShake)
 *   - Riduci flicker torcia (reduceTorchFlicker)
 *   - Disabilita motion blur (disableMotionBlur)
 *   - Mostra barra oscurità (showDarknessBar)
 */

import type { GameConfig } from '@/config/GameConfig.js';
import { resolveUiAccessibilityPalette } from '@/config/AccessibilityPalette.js';
import {
  cloneBindings,
  formatBindings,
  getDefaultBindingsForAction,
  isKeyCode,
  type ActionKind,
  type Binding,
} from '@/input/ActionMap.js';

export type AccessibilitySettings = GameConfig['accessibility'];
export interface ControlBindingSetting {
  readonly action: ActionKind;
  readonly label: string;
  readonly bindings: readonly Binding[];
}

export interface RuntimeSettings {
  readonly accessibility: AccessibilitySettings;
  readonly controls: Pick<GameConfig['controls'], 'mouseSensitivity' | 'mouseSmoothing' | 'invertY'> & {
    readonly bindings: readonly ControlBindingSetting[];
  };
  readonly render: Pick<GameConfig['render'], 'fov'>;
}

export interface SettingsMenu {
  /** Mostra il pannello con le impostazioni correnti. */
  show(settings: RuntimeSettings): void;

  /** Nasconde il pannello. */
  hide(): void;

  /** Il pannello è visibile? */
  readonly visible: boolean;

  /** Callback chiamata quando l'utente applica o chiude. */
  onApply: ((settings: RuntimeSettings) => void) | null;
  onClose: (() => void) | null;

  /** Applica la presentazione del menu a runtime. */
  applyPresentation(
    settings: Pick<AccessibilitySettings, 'textScale' | 'highContrast' | 'colorBlindMode'>,
  ): void;

  /** Crea l'elemento DOM. */
  mount(container: HTMLElement): void;

  /** Rimuove dal DOM. */
  dispose(): void;
}

// ── Implementazione ──────────────────────────────────────────────────────

export function createSettingsMenu(): SettingsMenu {
  let rootEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let bindingsContainerEl: HTMLElement | null = null;
  let isVisible = false;
  let currentSettings: RuntimeSettings | null = null;
  let lastFocusedElement: HTMLElement | null = null;
  let pendingBindingAction: ActionKind | null = null;

  const menu: SettingsMenu = {
    onApply: null,
    onClose: null,

    get visible(): boolean {
      return isVisible;
    },

    show(settings: RuntimeSettings): void {
      currentSettings = cloneRuntimeSettings(settings);
      pendingBindingAction = null;
      isVisible = true;
      if (rootEl) {
        lastFocusedElement =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        rootEl.style.display = 'flex';
        populateForm(settings);
        focusFirstInteractiveElement();
      }
    },

    hide(): void {
      isVisible = false;
      pendingBindingAction = null;
      if (rootEl) {
        rootEl.style.display = 'none';
      }
      lastFocusedElement?.focus();
      lastFocusedElement = null;
    },

    mount(container: HTMLElement): void {
      rootEl = buildPanel();
      rootEl.style.display = 'none';
      container.appendChild(rootEl);
    },

    applyPresentation(
      settings: Pick<AccessibilitySettings, 'textScale' | 'highContrast' | 'colorBlindMode'>,
    ): void {
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

    dispose(): void {
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootEl = null;
      isVisible = false;
    },
  };

  function buildPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'settings-menu';
    panel.tabIndex = -1;
    panel.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(11, 9, 8, 0.92);
      z-index: 100; display: flex; align-items: center; justify-content: center;
      font-family: 'Courier New', monospace; color: #D4A05A;
      user-select: none; -webkit-user-select: none;
    `;

    const content = document.createElement('div');
    contentEl = content;
    content.id = 'settings-content';
    content.tabIndex = -1;
    content.setAttribute('role', 'dialog');
    content.setAttribute('aria-modal', 'true');
    content.setAttribute('aria-labelledby', 'settings-title');
    content.style.cssText = `
      background: #1A1512; border: 2px solid #4A2F1A; border-radius: 6px;
      padding: 32px; max-width: 520px; width: 90%; max-height: 85vh;
      overflow-y: auto; pointer-events: all;
    `;

    const title = document.createElement('h2');
    title.id = 'settings-title';
    title.textContent = '⚙ Accessibilità';
    title.style.cssText = `
      margin: 0 0 24px; font-size: 24px; color: #D4A05A;
      border-bottom: 1px solid #4A2F1A; padding-bottom: 12px;
    `;
    content.appendChild(title);

    // ── Form fields ──
    const fields = content;
    fields.appendChild(sectionTitle('Visione'));
    fields.appendChild(toggleRow('Luce Assistita', 'assistedLight', 'Aumenta la visibilità nelle zone buie'));
    fields.appendChild(toggleRow('Alto Contrasto', 'highContrast', 'Migliora la leggibilità di nemici e oggetti'));
    fields.appendChild(toggleRow('Telegrafi Amplificati', 'amplifiedTelegraphs', 'Rende più visibili gli attacchi nemici'));
    fields.appendChild(selectRow(
      'Daltonismo',
      'colorBlindMode',
      [
        { value: 'none', label: 'Nessuno' },
        { value: 'protanopia', label: 'Protanopia' },
        { value: 'deuteranopia', label: 'Deuteranopia' },
        { value: 'tritanopia', label: 'Tritanopia' },
      ],
      'Filtro colore per daltonismo',
    ));

    fields.appendChild(sectionTitle('Audio'));
    fields.appendChild(toggleRow('Indicatore Sonoro', 'soundIndicator', 'Mostra indicatori visivi per i suoni'));

    fields.appendChild(sectionTitle('Sottotitoli'));
    fields.appendChild(toggleRow('Nomi Personaggi', 'subtitleNames', 'Mostra il nome di chi parla'));
    fields.appendChild(toggleRow('Direzione Audio', 'subtitleDirections', 'Indica la direzione del suono'));

    fields.appendChild(sectionTitle('Gameplay'));
    // torchToggle rimosso (2026-08-16): F è già un toggle nativo — il setting
    // era ridondante e inerte (decisione A-02 formalizzata in PIANO_COMPLETAMENTO).
    fields.appendChild(toggleRow('Sprint Toggle', 'sprintToggle', 'Premi una volta per iniziare lo scatto'));

    fields.appendChild(sectionTitle('Comfort'));
    fields.appendChild(toggleRow('Riduci Vibrazione', 'reduceCameraShake', 'Attenua le vibrazioni della camera'));
    fields.appendChild(toggleRow('Riduci Flicker Torcia', 'reduceTorchFlicker', 'Rende la torcia più stabile'));
    fields.appendChild(toggleRow('Disabilita Motion Blur', 'disableMotionBlur', 'Rimuove l\'effetto motion blur'));
    fields.appendChild(toggleRow('Barra Oscurità', 'showDarknessBar', 'Mostra il livello di oscurità nell\'HUD'));

    fields.appendChild(sliderRow(
      'Scala Testo',
      'textScale',
      1.0,
      1.6,
      0.1,
      'Dimensione relativa del testo HUD',
    ));

    fields.appendChild(sectionTitle('Controlli'));
    fields.appendChild(sliderRow(
      'Sensibilità Mouse',
      'mouseSensitivity',
      0.1,
      5.0,
      0.1,
      'Velocità del mouse look (0.1 = 10% · 1.0 = 100% · 5.0 = 500%)',
      (value: number) => `${Math.round(value * 100)}%`,
    ));
    fields.appendChild(sliderRow(
      'Smoothing Mouse',
      'mouseSmoothing',
      0.0,
      0.95,
      0.05,
      'Morbidezza della rotazione: più alto = sguardo più lento e fluido',
      (value: number) => `${Math.round(value * 100)}%`,
    ));
    fields.appendChild(toggleRow('Inverti Y', 'invertY', 'Inverte l asse verticale della visuale'));

    fields.appendChild(sectionTitle('Rebind Controlli'));
    bindingsContainerEl = document.createElement('div');
    bindingsContainerEl.id = 'settings-bindings';
    bindingsContainerEl.style.cssText = 'display: flex; flex-direction: column; gap: 10px;';
    fields.appendChild(bindingsContainerEl);

    fields.appendChild(sectionTitle('Video'));
    fields.appendChild(sliderRow(
      'FOV',
      'fov',
      75,
      105,
      1,
      'Campo visivo della camera',
    ));

    // ── Pulsanti ──
    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = `
      display: flex; gap: 12px; justify-content: flex-end; margin-top: 28px;
      border-top: 1px solid #4A2F1A; padding-top: 20px;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Annulla';
    cancelBtn.style.cssText = buttonStyle('#4A2F1A');
    cancelBtn.addEventListener('click', () => {
      if (menu.onClose) {
        menu.onClose();
      } else {
        menu.hide();
      }
    });

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = 'Applica';
    applyBtn.style.cssText = buttonStyle('#D4A05A');
    applyBtn.addEventListener('click', () => {
      const settings = readForm();
      if (settings && menu.onApply) {
        menu.onApply(settings);
      } else {
        menu.hide();
      }
    });

    panel.addEventListener('keydown', (e: KeyboardEvent) => {
      if (pendingBindingAction && isKeyCode(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        updateBinding(pendingBindingAction, [{ kind: 'key', code: e.code }]);
        pendingBindingAction = null;
        renderBindingRows();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (menu.onClose) {
          menu.onClose();
        } else {
          menu.hide();
        }
        return;
      }
      if (e.key === 'Tab') {
        trapFocus(e);
      }
    });

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(applyBtn);
    content.appendChild(buttonRow);
    panel.appendChild(content);

    return panel;
  }

  function populateForm(settings: RuntimeSettings): void {
    for (const [key, value] of Object.entries(flattenSettings(settings))) {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#settings-menu [name="${key}"]`,
      );
      if (!el) continue;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = Boolean(value);
      } else if (el instanceof HTMLInputElement && el.type === 'range') {
        el.value = String(value);
        const display = document.getElementById(`settings-${key}-value`);
        if (display) {
          // G-18 V3: mostra i valori percentuali (sensibilità e smoothing)
          const numeric = Number(value);
          if (key === 'mouseSensitivity' || key === 'mouseSmoothing') {
            display.textContent = `${Math.round(numeric * 100)}%`;
          } else {
            display.textContent = String(value);
          }
        }
      } else if (el instanceof HTMLSelectElement) {
        el.value = String(value);
      }
    }
    renderBindingRows(settings.controls.bindings);
  }

  function readForm(): RuntimeSettings | null {
    if (!currentSettings) return null;
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(flattenSettings(currentSettings))) {
      const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(
        `#settings-menu [name="${key}"]`,
      );
      if (!el) continue;
      if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        result[key] = el.checked;
      } else if (el instanceof HTMLInputElement && el.type === 'range') {
        result[key] = parseFloat(el.value);
      } else if (el instanceof HTMLSelectElement) {
        result[key] = el.value;
      }
    }

    return {
      accessibility: {
        ...currentSettings.accessibility,
        assistedLight: Boolean(result.assistedLight),
        amplifiedTelegraphs: Boolean(result.amplifiedTelegraphs),
        highContrast: Boolean(result.highContrast),
        colorBlindMode: String(result.colorBlindMode) as AccessibilitySettings['colorBlindMode'],
        subtitleNames: Boolean(result.subtitleNames),
        subtitleDirections: Boolean(result.subtitleDirections),
        soundIndicator: Boolean(result.soundIndicator),
        textScale: Number(result.textScale),
        sprintToggle: Boolean(result.sprintToggle),
        reduceCameraShake: Boolean(result.reduceCameraShake),
        reduceTorchFlicker: Boolean(result.reduceTorchFlicker),
        disableMotionBlur: Boolean(result.disableMotionBlur),
        showDarknessBar: Boolean(result.showDarknessBar),
      },
      controls: {
        mouseSensitivity: Number(result.mouseSensitivity),
        mouseSmoothing: Number.isFinite(Number(result.mouseSmoothing))
          ? Number(result.mouseSmoothing)
          : currentSettings.controls.mouseSmoothing,
        invertY: Boolean(result.invertY),
        bindings: currentSettings.controls.bindings.map((binding) => ({
          action: binding.action,
          label: binding.label,
          bindings: cloneBindings(binding.bindings),
        })),
      },
      render: {
        fov: Number(result.fov),
      },
    };
  }

  function focusFirstInteractiveElement(): void {
    const focusable = getFocusableElements();
    const first = focusable[0] ?? contentEl ?? rootEl;
    first?.focus();
  }

  function trapFocus(event: KeyboardEvent): void {
    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      contentEl?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last?.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function getFocusableElements(): HTMLElement[] {
    if (!rootEl) return [];
    return [...rootEl.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )].filter((element) => !element.hasAttribute('disabled'));
  }

  function updateBinding(action: ActionKind, bindings: readonly Binding[]): void {
    if (!currentSettings) {
      return;
    }
    currentSettings = {
      ...currentSettings,
      controls: {
        ...currentSettings.controls,
        bindings: currentSettings.controls.bindings.map((entry) =>
          entry.action === action
            ? { ...entry, bindings: cloneBindings(bindings) }
            : { ...entry, bindings: cloneBindings(entry.bindings) },
        ),
      },
    };
  }

  function renderBindingRows(bindings = currentSettings?.controls.bindings ?? []): void {
    if (!bindingsContainerEl) {
      return;
    }

    bindingsContainerEl.replaceChildren();

    const hint = document.createElement('div');
    hint.textContent = pendingBindingAction
      ? 'Premi il prossimo tasto per confermare il nuovo binding.'
      : 'Cambia il tasto principale di ogni azione senza uscire dal menu.';
    hint.style.cssText = 'font-size: 11px; color: #8B7355; margin-bottom: 4px;';
    bindingsContainerEl.appendChild(hint);

    for (const entry of bindings) {
      const row = document.createElement('div');
      row.style.cssText = `
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 10px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(74, 47, 26, 0.45);
      `;

      const labelContainer = document.createElement('div');

      const labelEl = document.createElement('div');
      labelEl.textContent = entry.label;
      labelEl.style.cssText = 'font-size: 14px;';

      const bindingSummary = document.createElement('div');
      bindingSummary.textContent =
        pendingBindingAction === entry.action ? 'Premi un tasto...' : formatBindings(entry.bindings);
      bindingSummary.style.cssText = 'font-size: 11px; color: #8B7355; margin-top: 2px;';

      labelContainer.appendChild(labelEl);
      labelContainer.appendChild(bindingSummary);

      const captureButton = document.createElement('button');
      captureButton.type = 'button';
      captureButton.textContent = pendingBindingAction === entry.action ? 'Annulla' : 'Cambia';
      captureButton.style.cssText = buttonStyle('#D4A05A');
      captureButton.addEventListener('click', () => {
        pendingBindingAction = pendingBindingAction === entry.action ? null : entry.action;
        renderBindingRows();
      });

      const resetButton = document.createElement('button');
      resetButton.type = 'button';
      resetButton.textContent = 'Default';
      resetButton.style.cssText = buttonStyle('#4A2F1A');
      resetButton.addEventListener('click', () => {
        pendingBindingAction = null;
        updateBinding(entry.action, getDefaultBindingsForAction(entry.action));
        renderBindingRows();
      });

      row.appendChild(labelContainer);
      row.appendChild(captureButton);
      row.appendChild(resetButton);
      bindingsContainerEl.appendChild(row);
    }
  }

  return menu;
}

function flattenSettings(settings: RuntimeSettings): Record<string, unknown> {
  return {
    ...settings.accessibility,
    mouseSensitivity: settings.controls.mouseSensitivity,
    mouseSmoothing: settings.controls.mouseSmoothing,
    invertY: settings.controls.invertY,
    ...settings.render,
  };
}

function cloneRuntimeSettings(settings: RuntimeSettings): RuntimeSettings {
  return {
    accessibility: { ...settings.accessibility },
    controls: {
      mouseSensitivity: settings.controls.mouseSensitivity,
      mouseSmoothing: settings.controls.mouseSmoothing,
      invertY: settings.controls.invertY,
      bindings: settings.controls.bindings.map((binding) => ({
        action: binding.action,
        label: binding.label,
        bindings: cloneBindings(binding.bindings),
      })),
    },
    render: { ...settings.render },
  };
}

// ── DOM helpers ──────────────────────────────────────────────────────────

function sectionTitle(text: string): HTMLElement {
  const el = document.createElement('h3');
  el.textContent = text;
  el.style.cssText = `
    margin: 20px 0 10px; font-size: 16px; color: #2E8B8B;
    border-bottom: 1px solid #2A2A2A; padding-bottom: 4px;
  `;
  return el;
}

function toggleRow(
  label: string,
  name: string,
  description: string,
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 0; gap: 12px;
  `;

  const labelContainer = document.createElement('div');
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = 'font-size: 14px; cursor: pointer;';
  labelEl.setAttribute('for', `setting-${name}`);

  const descEl = document.createElement('div');
  descEl.textContent = description;
  descEl.style.cssText = 'font-size: 11px; color: #8B7355; margin-top: 2px;';

  labelContainer.appendChild(labelEl);
  labelContainer.appendChild(descEl);

  const toggle = document.createElement('input');
  toggle.type = 'checkbox';
  toggle.name = name;
  toggle.id = `setting-${name}`;
  toggle.style.cssText = 'width: 18px; height: 18px; accent-color: #D4A05A; cursor: pointer;';

  row.appendChild(labelContainer);
  row.appendChild(toggle);
  return row;
}

function selectRow(
  label: string,
  name: string,
  options: readonly { value: string; label: string }[],
  description: string,
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = `
    display: flex; align-items: center; justify-content: space-between;
    padding: 6px 0; gap: 12px;
  `;

  const labelContainer = document.createElement('div');
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = 'font-size: 14px;';
  labelEl.setAttribute('for', `setting-${name}`);

  const descEl = document.createElement('div');
  descEl.textContent = description;
  descEl.style.cssText = 'font-size: 11px; color: #8B7355; margin-top: 2px;';

  labelContainer.appendChild(labelEl);
  labelContainer.appendChild(descEl);

  const select = document.createElement('select');
  select.name = name;
  select.id = `setting-${name}`;
  select.style.cssText = `
    background: #1A1512; color: #D4A05A; border: 1px solid #4A2F1A;
    padding: 4px 8px; font-family: 'Courier New', monospace; font-size: 13px;
    cursor: pointer; min-width: 130px;
  `;

  for (const opt of options) {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }

  row.appendChild(labelContainer);
  row.appendChild(select);
  return row;
}

function sliderRow(
  label: string,
  name: string,
  min: number,
  max: number,
  step: number,
  description: string,
  format: (value: number) => string = (value: number) => String(value),
): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'padding: 6px 0;';

  const labelRow = document.createElement('div');
  labelRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.cssText = 'font-size: 14px;';
  labelEl.setAttribute('for', `setting-${name}`);

  const valueDisplay = document.createElement('span');
  valueDisplay.id = `settings-${name}-value`;
  valueDisplay.style.cssText = 'font-size: 13px; color: #2E8B8B; min-width: 40px; text-align: right;';

  labelRow.appendChild(labelEl);
  labelRow.appendChild(valueDisplay);

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.name = name;
  slider.id = `setting-${name}`;
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.style.cssText = `
    width: 100%; margin-top: 4px; accent-color: #D4A05A; cursor: pointer;
  `;
  slider.addEventListener('input', () => {
    valueDisplay.textContent = format(Number(slider.value));
  });

  const descEl = document.createElement('div');
  descEl.textContent = description;
  descEl.style.cssText = 'font-size: 11px; color: #8B7355; margin-top: 2px;';

  row.appendChild(labelRow);
  row.appendChild(slider);
  row.appendChild(descEl);
  return row;
}

function buttonStyle(color: string): string {
  return `
    padding: 8px 24px; background: transparent; border: 1px solid ${color};
    color: ${color}; font-family: 'Courier New', monospace; font-size: 14px;
    cursor: pointer; border-radius: 3px; transition: background 0.2s;
  `;
}
