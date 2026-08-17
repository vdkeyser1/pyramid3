/**
 * Tests: InputSystem — keyboard, mouse and input frame polling.
 *
 * Nota: i test DOM-rich (attach/detach con eventi reali) richiedono jsdom.
 * Questo test copre solo il costrutto InputFrame e i metodi di base.
 */

import { describe, it, expect, vi } from 'vitest';
import { createActionMap, ActionKind, KeyCode } from '@/input/ActionMap.js';
import { createInputSystem } from '@/input/InputSystem.js';

type TestEvent = Record<string, unknown>;

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<(event: TestEvent) => void>>();

  addEventListener(type: string, listener: (event: TestEvent) => void): void {
    const bucket = this.listeners.get(type) ?? new Set<(event: TestEvent) => void>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event: TestEvent) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: TestEvent): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe('InputSystem', () => {
  it('crea un sistema di input con action map', () => {
    const map = createActionMap();
    const input = createInputSystem(map);
    expect(input).toBeDefined();
    expect(input.frame).toBeDefined();
  });

  it('beginFrame resetta i set di azioni', () => {
    const map = createActionMap();
    const input = createInputSystem(map);

    // Il frame inizia vuoto
    expect(input.frame.heldActions.size).toBe(0);
    expect(input.frame.pressedActions.size).toBe(0);
    expect(input.frame.releasedActions.size).toBe(0);

    // beginFrame su un sistema pulito non cambia nulla
    input.beginFrame();
    expect(input.frame.heldActions.size).toBe(0);
  });

  it('beginFrame azzera delta mouse e scroll', () => {
    const map = createActionMap();
    const input = createInputSystem(map);

    // Dopo beginFrame, delta sono zero
    input.beginFrame();
    expect(input.frame.mouseDeltaX).toBe(0);
    expect(input.frame.mouseDeltaY).toBe(0);
    expect(input.frame.scrollDelta).toBe(0);
  });

  it('beginFrame espone i delta mouse e scroll accumulati prima di azzerarli', () => {
    const map = createActionMap();
    const input = createInputSystem(map);
    const fakeDocument: FakeEventTarget & {
      pointerLockElement: HTMLElement | null;
      exitPointerLock: () => undefined;
    } = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null,
      exitPointerLock: () => undefined,
    });
    const fakeElementTarget = new FakeEventTarget();
    const fakeElement = fakeElementTarget as unknown as HTMLElement;

    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('navigator', {
      getGamepads: (): [] => [],
    });

    try {
      input.attach(fakeElement);

      fakeDocument.pointerLockElement = fakeElement;
      fakeDocument.dispatch('pointerlockchange', {});
      fakeElementTarget.dispatch('mousemove', {
        movementX: 12,
        movementY: -7,
      });
      fakeElementTarget.dispatch('wheel', {
        deltaY: 48,
      });

      input.beginFrame();
      expect(input.frame.mouseDeltaX).toBe(12);
      expect(input.frame.mouseDeltaY).toBe(-7);
      expect(input.frame.scrollDelta).toBe(48);

      input.beginFrame();
      expect(input.frame.mouseDeltaX).toBe(0);
      expect(input.frame.mouseDeltaY).toBe(0);
      expect(input.frame.scrollDelta).toBe(0);
    } finally {
      input.dispose();
      vi.unstubAllGlobals();
    }
  });

  it('consume rimuove un azione dal frame corrente', () => {
    const map = createActionMap();
    const input = createInputSystem(map);

    // Non possiamo testare consume su un'azione che non esiste,
    // ma deve essere safe da chiamare
    input.beginFrame();
    expect(() => {
      input.frame.consume(ActionKind.MoveForward);
    }).not.toThrow();
  });

  it('dispose non lancia errori su sistema non attaccato', () => {
    const map = createActionMap();
    const input = createInputSystem(map);
    expect(() => {
      input.dispose();
    }).not.toThrow();
  });

  it('gamepad: restituisce null se nessun gamepad connesso', () => {
    const map = createActionMap();
    const input = createInputSystem(map);
    input.beginFrame();
    // In ambiente di test senza gamepad, deve essere null
    expect(input.frame.gamepad).toBeNull();
  });

  it('applica una nuova action map a runtime', () => {
    const map = createActionMap();
    const input = createInputSystem(map);
    const remapped = map.remap(ActionKind.Interact, [{ kind: 'key', code: KeyCode.KeyF }]);
    const fakeDocument: FakeEventTarget & {
      pointerLockElement: HTMLElement | null;
      exitPointerLock: () => undefined;
    } = Object.assign(new FakeEventTarget(), {
      pointerLockElement: null,
      exitPointerLock: () => undefined,
    });
    const fakeElementTarget = new FakeEventTarget();
    const fakeElement = fakeElementTarget as unknown as HTMLElement;

    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('navigator', {
      getGamepads: (): [] => [],
    });

    try {
      input.attach(fakeElement);
      input.setActionMap(remapped);
      fakeDocument.dispatch('keydown', {
        code: KeyCode.KeyF,
        preventDefault: () => undefined,
      });

      input.beginFrame();

      expect(input.frame.isDown(ActionKind.Interact)).toBe(true);
      expect(input.frame.wasPressed(ActionKind.Interact)).toBe(true);
    } finally {
      input.dispose();
      vi.unstubAllGlobals();
    }
  });
});
