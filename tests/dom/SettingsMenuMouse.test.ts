import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '@/config/GameConfig.js';
import { createActionMap, cloneBindings } from '@/input/ActionMap.js';
import { createSettingsMenu } from '@/ui/SettingsMenu.js';
import type { RuntimeSettings } from '@/ui/SettingsMenu.js';

function buildSettings(overrides?: Partial<RuntimeSettings['controls']>): RuntimeSettings {
  return {
    accessibility: { ...DEFAULT_CONFIG.accessibility },
    controls: {
      mouseSensitivity: DEFAULT_CONFIG.controls.mouseSensitivity,
      mouseSmoothing: DEFAULT_CONFIG.controls.mouseSmoothing,
      invertY: DEFAULT_CONFIG.controls.invertY,
      bindings: createActionMap().entries().map((entry) => ({
        action: entry.action,
        label: entry.label,
        bindings: cloneBindings(entry.bindings),
      })),
      ...overrides,
    },
    render: { fov: DEFAULT_CONFIG.render.fov },
  };
}

describe('SettingsMenu — controlli mouse (G-18 V3)', () => {
  it('espone gli slider Sensibilità e Smoothing con valore percentuale', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const menu = createSettingsMenu();
    menu.mount(container);
    menu.show(buildSettings());

    const sensitivity = document.querySelector<HTMLInputElement>('#setting-mouseSensitivity');
    const smoothing = document.querySelector<HTMLInputElement>('#setting-mouseSmoothing');
    const smoothingDisplay = document.querySelector('#settings-mouseSmoothing-value');

    expect(sensitivity).not.toBeNull();
    expect(smoothing).not.toBeNull();
    expect(smoothing?.type).toBe('range');
    expect(smoothing?.min).toBe('0');
    expect(smoothing?.max).toBe('0.95');
    expect(smoothing?.step).toBe('0.05');
    // Display percentuale del valore iniziale (0.55 → "55%")
    expect(smoothingDisplay?.textContent).toBe('55%');

    menu.dispose();
  });

  it('la percentuale segue il valore dello slider in tempo reale', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const menu = createSettingsMenu();
    menu.mount(container);
    menu.show(buildSettings());

    const smoothing = document.querySelector<HTMLInputElement>('#setting-mouseSmoothing');
    const display = document.querySelector('#settings-mouseSmoothing-value');
    expect(smoothing).not.toBeNull();
    expect(display).not.toBeNull();
    if (!smoothing || !display) return;

    smoothing.value = '0.8';
    smoothing.dispatchEvent(new Event('input', { bubbles: true }));
    expect(display.textContent).toBe('80%');

    menu.dispose();
  });
});
