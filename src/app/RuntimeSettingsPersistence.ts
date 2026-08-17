/**
 * Scopo: serializzare e recuperare le impostazioni runtime nel profilo save.
 * Ownership: GameApplication usa queste funzioni come bridge verso SaveManager.
 */

import { GameConfigSchema } from '@/config/GameConfig.js';
import { ActionKind, type Binding, KeyCode, MouseButton, cloneBindings } from '@/input/ActionMap.js';
import type { SaveData } from '@/progression/SaveManager.js';
import type { RuntimeSettings } from '@/ui/SettingsMenu.js';
import { z } from 'zod/v4';

const RUNTIME_SETTINGS_KEY = 'runtimeSettings';

const KeyBindingSchema = z.object({
  kind: z.literal('key'),
  code: z.enum(Object.values(KeyCode) as [KeyCode, ...KeyCode[]]),
});

const MouseBindingSchema = z.object({
  kind: z.literal('mouse'),
  button: z.union([
    z.literal(MouseButton.Left),
    z.literal(MouseButton.Middle),
    z.literal(MouseButton.Right),
  ]),
});

const BindingSchema = z.union([KeyBindingSchema, MouseBindingSchema]);
const ActionBindingSchema = z.object({
  action: z.enum(Object.values(ActionKind) as [ActionKind, ...ActionKind[]]),
  bindings: z.array(BindingSchema),
});

const RuntimeSettingsSchema = z.object({
  accessibility: GameConfigSchema.shape.accessibility,
  controls: z.object({
    mouseSensitivity: GameConfigSchema.shape.controls.shape.mouseSensitivity,
    mouseSmoothing: GameConfigSchema.shape.controls.shape.mouseSmoothing,
    invertY: GameConfigSchema.shape.controls.shape.invertY,
    bindings: z.array(ActionBindingSchema).optional().default([]),
  }),
  render: z.object({
    fov: GameConfigSchema.shape.render.shape.fov,
  }),
});

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

function mergeBindings(
  fallback: RuntimeSettings,
  bindings: readonly { action: ActionKind; bindings: readonly Binding[] }[],
): RuntimeSettings['controls']['bindings'] {
  const bindingsByAction = new Map(bindings.map((binding) => [binding.action, binding.bindings]));
  return fallback.controls.bindings.map((binding) => ({
    action: binding.action,
    label: binding.label,
    bindings: cloneBindings(bindingsByAction.get(binding.action) ?? binding.bindings),
  }));
}

export function readSavedRuntimeSettings(
  save: SaveData,
  fallback: RuntimeSettings,
): RuntimeSettings {
  const persisted = save.payload.settings[RUNTIME_SETTINGS_KEY];
  const parsed = RuntimeSettingsSchema.safeParse(persisted);
  if (!parsed.success) {
    return cloneRuntimeSettings(fallback);
  }
  return {
    accessibility: { ...parsed.data.accessibility },
    controls: {
      mouseSensitivity: parsed.data.controls.mouseSensitivity,
      mouseSmoothing: parsed.data.controls.mouseSmoothing,
      invertY: parsed.data.controls.invertY,
      bindings: mergeBindings(fallback, parsed.data.controls.bindings),
    },
    render: { ...parsed.data.render },
  };
}

export function writeRuntimeSettingsToSave(
  save: SaveData,
  settings: RuntimeSettings,
): SaveData {
  const persisted = RuntimeSettingsSchema.parse({
    accessibility: settings.accessibility,
    controls: {
      mouseSensitivity: settings.controls.mouseSensitivity,
      mouseSmoothing: settings.controls.mouseSmoothing,
      invertY: settings.controls.invertY,
      bindings: settings.controls.bindings.map((binding) => ({
        action: binding.action,
        bindings: cloneBindings(binding.bindings),
      })),
    },
    render: settings.render,
  });
  return {
    ...save,
    payload: {
      ...save.payload,
      settings: {
        ...save.payload.settings,
        [RUNTIME_SETTINGS_KEY]: persisted,
      },
    },
  };
}
