/**
 * Scopo: sistema di input che aggrega tastiera, mouse e gamepad in uno stato
 *        frame-by-frame. Produce azioni digitali consumate dai sistemi ECS.
 * Ownership: GameApplication crea e distrugge l'InputSystem.
 * Invarianti:
 *   - lo stato viene resettato a ogni beginFrame();
 *   - consumed = true rimuove l'azione dal set corrente;
 *   - gli eventi DOM sono gestiti in modo passivo dove possibile.
 * Failure mode: un tasto non mappato non produce alcuna azione (silenzioso).
 *
 * Il polling funziona così:
 *   1. beginFrame() resetta i delta (mouse move, scroll) e i flag consumed.
 *   2. I listener DOM aggiornano lo stato raw durante il frame.
 *   3. I consumer chiamano isDown(), wasPressed(), getAxis() ecc.
 *   4. Le azioni consumate vengono rimosse fino al frame successivo.
 */

import {
  type ActionMap,
  ActionKind,
  KeyCode,
} from '@/input/ActionMap.js';

/** Stato grezzo di un singolo tasto o pulsante. */
export interface KeyState {
  /** Il tasto è premuto in questo frame. */
  down: boolean;
  /** Il tasto è stato premuto esattamente in questo frame (edge positivo). */
  pressed: boolean;
  /** Il tasto è stato rilasciato in questo frame (edge negativo). */
  released: boolean;
  /** Consumato da un sistema; salta per il resto del frame. */
  consumed: boolean;
}

export interface GamepadState {
  readonly connected: boolean;
  readonly id: string;
  /** Assi normalizzati [-1, 1]. */
  readonly axes: readonly number[];
  /** Pulsanti (GamepadButton). */
  readonly buttons: readonly GamepadButton[];
}

/** Maschera bit per le azioni digitali (per lookup veloce). */
export interface InputFrame {
  /** Azioni digitali "held" (premute in questo frame). */
  readonly heldActions: ReadonlySet<ActionKind>;
  /** Azioni digitali "just pressed" (edge positivo). */
  readonly pressedActions: ReadonlySet<ActionKind>;
  /** Azioni digitali "just released" (edge negativo). */
  readonly releasedActions: ReadonlySet<ActionKind>;

  /** Delta mouse look (pixel raw). */
  readonly mouseDeltaX: number;
  readonly mouseDeltaY: number;

  /** Scroll wheel delta. */
  readonly scrollDelta: number;

  /** Stato gamepad corrente. */
  readonly gamepad: GamepadState | null;

  /** Lookup veloce: l'azione è held? */
  isDown(action: ActionKind): boolean;

  /** Lookup veloce: l'azione è stata appena premuta? */
  wasPressed(action: ActionKind): boolean;

  /** Lookup veloce: l'azione è stata appena rilasciata? */
  wasReleased(action: ActionKind): boolean;

  /** Consuma l'azione (nessun altro sistema la vedrà). */
  consume(action: ActionKind): void;
}

export interface InputSystem {
  /** Prepara lo stato per un nuovo frame. */
  beginFrame(): void;

  /** Restituisce lo stato readonly del frame corrente. */
  readonly frame: InputFrame;

  /** Registra i listener sugli elementi DOM (chiamato una volta). */
  attach(element: HTMLElement): void;

  /** Rimuove i listener DOM. */
  detach(): void;

  /** Dispone tutte le risorse. */
  dispose(): void;

  /** Aggiorna la action map usata per risolvere i binding a runtime. */
  setActionMap(actionMap: ActionMap): void;

  /**
   * M-01: assi virtuali (touch / accessibilità).
   * move −1..1; lookDX/DY pixel-equivalenti sommati al mouse delta del frame.
   */
  setVirtualAxes(axes: {
    readonly moveX: number;
    readonly moveZ: number;
    readonly lookDX?: number;
    readonly lookDY?: number;
  }): void;

  /** M-01: pulsanti virtuali tenuti/premuti (edge = wasPressed sul frame). */
  setVirtualButtons(down: ReadonlySet<ActionKind>): void;

  /** Assi movimento virtuali del frame corrente (−1..1). */
  getVirtualMove(): { readonly x: number; readonly z: number };
}

// ── Implementazione ──────────────────────────────────────────────────────

export function createInputSystem(actionMap: ActionMap): InputSystem {
  let currentActionMap = actionMap;
  // Stato raw per tasti e pulsanti (indirizzato per code/button)
  const rawState = new Map<string, KeyState>();
  const mouseButtonState = new Map<number, KeyState>();

  // Accumulatori per frame
  const held = new Set<ActionKind>();
  const pressed = new Set<ActionKind>();
  const released = new Set<ActionKind>();
  let currentPressed = new Set<ActionKind>();
  let currentReleased = new Set<ActionKind>();
  let pendingMouseDX = 0;
  let pendingMouseDY = 0;
  let pendingScrollDY = 0;
  let frameMouseDX = 0;
  let frameMouseDY = 0;
  let frameScrollDY = 0;
  let currentGamepad: GamepadState | null = null;
  let virtualMoveX = 0;
  let virtualMoveZ = 0;
  let virtualLookDX = 0;
  let virtualLookDY = 0;
  let virtualButtons = new Set<ActionKind>();
  let prevVirtualButtons = new Set<ActionKind>();

  // DOM listener refs per cleanup
  let targetElement: HTMLElement | null = null;
  let pointerLocked = false;

  function ensureKeyState(map: Map<string, KeyState>, key: string): KeyState {
    const existing = map.get(key);
    if (existing) return existing;
    const state: KeyState = { down: false, pressed: false, released: false, consumed: false };
    map.set(key, state);
    return state;
  }

  function ensureMouseState(button: number): KeyState {
    const existing = mouseButtonState.get(button);
    if (existing) return existing;
    const state: KeyState = { down: false, pressed: false, released: false, consumed: false };
    mouseButtonState.set(button, state);
    return state;
  }

  function resolveActions(
    code: string | undefined,
    mouseButton: number | undefined,
  ): ActionKind[] {
    const actions: ActionKind[] = [];
    for (const entry of currentActionMap.entries()) {
      for (const binding of entry.bindings) {
        if (code !== undefined && binding.kind === 'key' && binding.code === code) {
          actions.push(entry.action);
          break;
        }
        if (mouseButton !== undefined && binding.kind === 'mouse' && binding.button === mouseButton) {
          actions.push(entry.action);
          break;
        }
      }
    }
    return actions;
  }

  function addToSets(action: ActionKind): void {
    held.add(action);
    pressed.add(action);
  }

  function removeFromSets(action: ActionKind): void {
    held.delete(action);
    released.add(action);
  }

  // ── Event handlers ────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent): void {
    const state = ensureKeyState(rawState, e.code);
    if (!state.down) {
      state.down = true;
      state.pressed = true;
      state.consumed = false;
      for (const action of resolveActions(e.code, undefined)) {
        addToSets(action);
        if (action === ActionKind.DebugOverlay) {
          e.preventDefault();
        }
      }
    }
    // Previeni comportamenti di default per tasti di gioco
    if (
      e.code === KeyCode.Tab ||
      e.code === KeyCode.Space ||
      e.code === KeyCode.Escape
    ) {
      e.preventDefault();
    }
  }

  function onKeyUp(e: KeyboardEvent): void {
    const state = rawState.get(e.code);
    if (state?.down) {
      state.down = false;
      state.released = true;
      for (const action of resolveActions(e.code, undefined)) {
        removeFromSets(action);
      }
    }
  }

  function onMouseDown(e: MouseEvent): void {
    const state = ensureMouseState(e.button);
    if (!state.down) {
      state.down = true;
      state.pressed = true;
      state.consumed = false;
      for (const action of resolveActions(undefined, e.button)) {
        addToSets(action);
      }
    }
  }

  function onMouseUp(e: MouseEvent): void {
    const state = mouseButtonState.get(e.button);
    if (state?.down) {
      state.down = false;
      state.released = true;
      for (const action of resolveActions(undefined, e.button)) {
        removeFromSets(action);
      }
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (pointerLocked) {
      pendingMouseDX += e.movementX;
      pendingMouseDY += e.movementY;
    }
  }

  function onWheel(e: WheelEvent): void {
    pendingScrollDY += e.deltaY;
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  function onPointerLockChange(): void {
    pointerLocked = document.pointerLockElement === targetElement;
  }

  function pollGamepad(): void {
    try {
      const gamepads = navigator.getGamepads();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- gamepads can be null at runtime
      if (gamepads) {
        const pad = gamepads[0];
        if (pad != null) {
          currentGamepad = {
            connected: pad.connected,
            id: pad.id,
            axes: [...pad.axes],
            buttons: pad.buttons.map((b) => ({
              pressed: b.pressed,
              touched: b.touched,
              value: b.value,
            })),
          };
        } else {
          currentGamepad = null;
        }
      } else {
        currentGamepad = null;
      }
    } catch {
      currentGamepad = null;
    }
  }

  // ── InputFrame ─────────────────────────────────────────────────────

  const frame: InputFrame = {
    get heldActions(): ReadonlySet<ActionKind> {
      return held;
    },
    get pressedActions(): ReadonlySet<ActionKind> {
      return currentPressed;
    },
    get releasedActions(): ReadonlySet<ActionKind> {
      return currentReleased;
    },
    get mouseDeltaX(): number {
      return frameMouseDX;
    },
    get mouseDeltaY(): number {
      return frameMouseDY;
    },
    get scrollDelta(): number {
      return frameScrollDY;
    },
    get gamepad(): GamepadState | null {
      return currentGamepad;
    },

    isDown(action: ActionKind): boolean {
      return held.has(action);
    },

    wasPressed(action: ActionKind): boolean {
      return currentPressed.has(action);
    },

    wasReleased(action: ActionKind): boolean {
      return currentReleased.has(action);
    },

    consume(action: ActionKind): void {
      currentPressed.delete(action);
      held.delete(action);
    },
  };

  // ── Public API ─────────────────────────────────────────────────────

  return {
    get frame(): InputFrame {
      return frame;
    },

    beginFrame(): void {
      // Reset edge flags per i tasti
      for (const state of rawState.values()) {
        state.pressed = false;
        state.released = false;
      }
      for (const state of mouseButtonState.values()) {
        state.pressed = false;
        state.released = false;
      }

      // Salva i tasti premuti tra i frame, poi resetta per il frame successivo
      currentPressed = new Set(pressed);
      currentReleased = new Set(released);
      pressed.clear();
      released.clear();

      // Pubblica i delta accumulati dall'ultimo frame e azzera gli accumulatori
      frameMouseDX = pendingMouseDX + virtualLookDX;
      frameMouseDY = pendingMouseDY + virtualLookDY;
      frameScrollDY = pendingScrollDY;
      pendingMouseDX = 0;
      pendingMouseDY = 0;
      pendingScrollDY = 0;
      virtualLookDX = 0;
      virtualLookDY = 0;

      // Ricostruisci held dal raw state
      held.clear();
      for (const [code, state] of rawState) {
        if (state.down) {
          for (const action of resolveActions(code, undefined)) {
            held.add(action);
          }
        }
      }
      for (const [btn, state] of mouseButtonState) {
        if (state.down) {
          for (const action of resolveActions(undefined, btn)) {
            held.add(action);
          }
        }
      }

      // M-01: virtual buttons (touch) → held + edge pressed
      for (const action of virtualButtons) {
        held.add(action);
        if (!prevVirtualButtons.has(action)) {
          pressed.add(action);
        }
      }
      for (const action of prevVirtualButtons) {
        if (!virtualButtons.has(action)) {
          released.add(action);
        }
      }
      prevVirtualButtons = new Set(virtualButtons);
      // virtualButtons restano finché setVirtualButtons non li aggiorna.

      // Poll gamepad
      pollGamepad();
    },

    attach(element: HTMLElement): void {
      if (targetElement) {
        detach();
      }
      targetElement = element;

      // Keyboard events SEMPRE sul document (funziona anche in pointer lock)
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      // Mouse events sull'elemento specifico
      element.addEventListener('mousedown', onMouseDown);
      element.addEventListener('mouseup', onMouseUp);
      element.addEventListener('mousemove', onMouseMove);
      element.addEventListener('wheel', onWheel, { passive: true });
      element.addEventListener('contextmenu', onContextMenu);
      document.addEventListener('pointerlockchange', onPointerLockChange);
    },

    detach(): void {
      if (!targetElement) return;

      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      targetElement.removeEventListener('mousedown', onMouseDown);
      targetElement.removeEventListener('mouseup', onMouseUp);
      targetElement.removeEventListener('mousemove', onMouseMove);
      targetElement.removeEventListener('wheel', onWheel);
      targetElement.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('pointerlockchange', onPointerLockChange);

      targetElement = null;
    },

    dispose(): void {
      this.detach();
      rawState.clear();
      mouseButtonState.clear();
      held.clear();
      pressed.clear();
      released.clear();
      currentPressed.clear();
      currentReleased.clear();
      pendingMouseDX = 0;
      pendingMouseDY = 0;
      pendingScrollDY = 0;
      frameMouseDX = 0;
      frameMouseDY = 0;
      frameScrollDY = 0;
      currentGamepad = null;
    },

    setActionMap(nextActionMap: ActionMap): void {
      currentActionMap = nextActionMap;
    },

    setVirtualAxes(axes): void {
      virtualMoveX = Math.max(-1, Math.min(1, axes.moveX));
      virtualMoveZ = Math.max(-1, Math.min(1, axes.moveZ));
      if (axes.lookDX !== undefined) virtualLookDX += axes.lookDX;
      if (axes.lookDY !== undefined) virtualLookDY += axes.lookDY;
    },

    setVirtualButtons(down): void {
      virtualButtons = new Set(down);
    },

    getVirtualMove() {
      return { x: virtualMoveX, z: virtualMoveZ };
    },
  };

  // Nested detach reference
  function detach(): void {
    if (!targetElement) return;

    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    targetElement.removeEventListener('mousedown', onMouseDown);
    targetElement.removeEventListener('mouseup', onMouseUp);
    targetElement.removeEventListener('mousemove', onMouseMove);
    targetElement.removeEventListener('wheel', onWheel);
    targetElement.removeEventListener('contextmenu', onContextMenu);
    document.removeEventListener('pointerlockchange', onPointerLockChange);

    targetElement = null;
  }
}
