/**
 * Tests: ActionMap — action definitions, default bindings, and remapping.
 */

import { describe, it, expect } from 'vitest';
import {
  createActionMap,
  ActionKind,
  KeyCode,
  MouseButton,
} from '@/input/ActionMap.js';

function getFirstKeyCode(map: ReturnType<typeof createActionMap>, action: ActionKind): string | undefined {
  const entry = map.get(action);
  const binding = entry?.bindings[0];
  return binding?.kind === 'key' ? binding.code : undefined;
}

describe('ActionMap', () => {
  it('creates a default action map with all actions', () => {
    const map = createActionMap();
    const entries = map.entries();
    // We have 25 defined actions
    expect(entries.length).toBeGreaterThanOrEqual(25);
  });

  it('returns an entry by action kind', () => {
    const map = createActionMap();
    const entry = map.get(ActionKind.MoveForward);
    expect(entry).toBeDefined();
    expect(entry?.action).toBe('MoveForward');
    expect(entry?.bindings.length).toBeGreaterThanOrEqual(1);
  });

  it('returns undefined for unknown action', () => {
    const map = createActionMap();
    const entry = map.get('INVALID_ACTION' as ActionKind);
    expect(entry).toBeUndefined();
  });

  it('maps WASD to movement', () => {
    const map = createActionMap();
    expect(getFirstKeyCode(map, ActionKind.MoveForward)).toBe(KeyCode.KeyW);
    expect(getFirstKeyCode(map, ActionKind.MoveBackward)).toBe(KeyCode.KeyS);
    expect(getFirstKeyCode(map, ActionKind.MoveLeft)).toBe(KeyCode.KeyA);
    expect(getFirstKeyCode(map, ActionKind.MoveRight)).toBe(KeyCode.KeyD);
  });

  it('maps F to torch toggle', () => {
    const map = createActionMap();
    expect(getFirstKeyCode(map, ActionKind.TorchToggle)).toBe(KeyCode.KeyF);
  });

  it('maps E to Interact', () => {
    const map = createActionMap();
    expect(getFirstKeyCode(map, ActionKind.Interact)).toBe(KeyCode.KeyE);
  });

  it('maps Space to Dodge', () => {
    const map = createActionMap();
    expect(getFirstKeyCode(map, ActionKind.Dodge)).toBe(KeyCode.Space);
  });

  it('binds Jump to Space by default', () => {
    const map = createActionMap();
    expect(getFirstKeyCode(map, ActionKind.Jump)).toBe(KeyCode.Space);
  });

  it('finds action by keyboard binding', () => {
    const map = createActionMap();
    const entry = map.findByBinding({ kind: 'key', code: KeyCode.KeyF });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe(ActionKind.TorchToggle);
  });

  it('finds action by mouse binding', () => {
    const map = createActionMap();
    const entry = map.findByBinding({ kind: 'mouse', button: MouseButton.Left });
    expect(entry).toBeDefined();
    expect(entry?.action).toBe(ActionKind.Attack);
  });

  it('remaps an action to new bindings', () => {
    const map = createActionMap();
    const remapped = map.remap(ActionKind.Dodge, [{ kind: 'key', code: KeyCode.ShiftLeft }]);

    // Original unchanged
    expect(getFirstKeyCode(map, ActionKind.Dodge)).toBe(KeyCode.Space);

    // Remapped changed
    expect(getFirstKeyCode(remapped, ActionKind.Dodge)).toBe(KeyCode.ShiftLeft);

    // Other actions unchanged in remapped
    expect(getFirstKeyCode(remapped, ActionKind.MoveForward)).toBe(KeyCode.KeyW);
  });

  it('immutability: remap creates new instance, does not mutate original', () => {
    const map = createActionMap();
    map.remap(ActionKind.MoveForward, [{ kind: 'key', code: KeyCode.KeyE }]); // discard
    expect(getFirstKeyCode(map, ActionKind.MoveForward)).toBe(KeyCode.KeyW);
  });
});
