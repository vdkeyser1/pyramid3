import { DEFAULT_CONFIG } from '@/config/GameConfig.js';
import {
  readSavedRuntimeSettings,
  writeRuntimeSettingsToSave,
} from '@/app/RuntimeSettingsPersistence.js';
import { cloneBindings, createActionMap, KeyCode } from '@/input/ActionMap.js';
import type { SaveData } from '@/progression/SaveManager.js';
import type { RuntimeSettings } from '@/ui/SettingsMenu.js';
import { describe, expect, it } from 'vitest';

interface RuntimeSettingsOverrides {
  readonly accessibility?: Partial<RuntimeSettings['accessibility']>;
  readonly controls?: Partial<RuntimeSettings['controls']>;
  readonly render?: Partial<RuntimeSettings['render']>;
}

function createRuntimeSettings(overrides?: RuntimeSettingsOverrides): RuntimeSettings {
  return {
    accessibility: { ...DEFAULT_CONFIG.accessibility, ...overrides?.accessibility },
    controls: {
      mouseSensitivity:
        overrides?.controls?.mouseSensitivity ?? DEFAULT_CONFIG.controls.mouseSensitivity,
      mouseSmoothing:
        overrides?.controls?.mouseSmoothing ?? DEFAULT_CONFIG.controls.mouseSmoothing,
      invertY: overrides?.controls?.invertY ?? DEFAULT_CONFIG.controls.invertY,
      bindings: createActionMap().entries().map((entry) => ({
        action: entry.action,
        label: entry.label,
        bindings: cloneBindings(entry.bindings),
      })),
    },
    render: { fov: overrides?.render?.fov ?? DEFAULT_CONFIG.render.fov },
  };
}

function createSaveData(): SaveData {
  return {
    schemaVersion: 1,
    contentVersion: '0.1.0',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    checksum: 'deadbeef',
    payload: {
      fragments: 0,
      pyramidsUnlocked: 1,
      bestiaryEntries: [],
      discoveredGrafts: [],
      kaNodes: [],
      claimedTreasureSiteIds: [],
      completedFloorIds: [],
      settings: {},
    },
  };
}

describe('RuntimeSettingsPersistence', () => {
  it('legge le impostazioni persistite dal profilo', () => {
    const settings = createRuntimeSettings({
      accessibility: { highContrast: true, sprintToggle: true },
      controls: { invertY: true, mouseSensitivity: 1.7, mouseSmoothing: 0.7 },
      render: { fov: 101 },
    });
    const save = writeRuntimeSettingsToSave(createSaveData(), settings);

    const restored = readSavedRuntimeSettings(save, createRuntimeSettings());

    expect(restored).toEqual(settings);
  });

  it('i vecchi save senza mouseSmoothing ricevono il default (retrocompatibilità)', () => {
    const settings = createRuntimeSettings();
    const save = writeRuntimeSettingsToSave(createSaveData(), settings);
    // Simula un save scritto da una versione precedente: rimuovi il campo.
    const legacyPayload = save.payload.settings as unknown as Record<string, Record<string, unknown>>;
    const key = Object.keys(legacyPayload)[0];
    if (key) {
      const controls = legacyPayload[key]?.controls as Record<string, unknown> | undefined;
      if (controls) {
        delete controls.mouseSmoothing;
      }
    }

    const restored = readSavedRuntimeSettings(save, createRuntimeSettings());

    expect(restored.controls.mouseSmoothing).toBe(DEFAULT_CONFIG.controls.mouseSmoothing);
  });

  it('persiste e reidrata anche i rebind dei controlli', () => {
    const settings = createRuntimeSettings();
    const remappedBindings = settings.controls.bindings.map((binding) =>
      binding.action === 'Interact'
        ? { ...binding, bindings: [{ kind: 'key' as const, code: KeyCode.KeyF }] }
        : binding,
    );
    const save = writeRuntimeSettingsToSave(createSaveData(), {
      ...settings,
      controls: {
        ...settings.controls,
        bindings: remappedBindings,
      },
    });

    const restored = readSavedRuntimeSettings(save, createRuntimeSettings());
    const interactBinding = restored.controls.bindings.find((binding) => binding.action === 'Interact');

    expect(interactBinding?.bindings).toEqual([{ kind: 'key', code: KeyCode.KeyF }]);
  });

  it('torna al fallback se il payload persistito e invalido', () => {
    const fallback = createRuntimeSettings({
      accessibility: { assistedLight: true },
      render: { fov: 96 },
    });
    const save = createSaveData();
    save.payload.settings.runtimeSettings = {
      render: { fov: 999 },
    };

    const restored = readSavedRuntimeSettings(save, fallback);

    expect(restored).toEqual(fallback);
  });
});
