/**
 * M-02 — Gamepad API Adapter
 * Polls navigator.getGamepads() e mappa il layout standard del gamepad
 * ad azioni di gioco. Filtraggio dead-zone, supporto rumble.
 * Nessun uso di performance.now() — la gestione del tempo è del game loop.
 */

import { createLogger } from '@/core/Logger.js';

const log = createLogger('GamepadAdapter');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GamepadAxes {
  readonly leftX: number;   // -1..1 (sinistra = -1, destra = +1)
  readonly leftY: number;   // -1..1 (su = -1, giù = +1)
  readonly rightX: number;
  readonly rightY: number;
}

export interface GamepadButtons {
  readonly actionSouth: boolean;   // A / Cross
  readonly actionEast: boolean;    // B / Circle
  readonly actionWest: boolean;    // X / Square
  readonly actionNorth: boolean;   // Y / Triangle
  readonly leftBumper: boolean;
  readonly rightBumper: boolean;
  readonly leftTrigger: number;    // 0..1
  readonly rightTrigger: number;   // 0..1
  readonly start: boolean;
  readonly select: boolean;
  readonly dpadUp: boolean;
  readonly dpadDown: boolean;
  readonly dpadLeft: boolean;
  readonly dpadRight: boolean;
  readonly leftStick: boolean;     // L3
  readonly rightStick: boolean;    // R3
}

export interface GamepadState {
  readonly connected: boolean;
  readonly id: string;
  readonly axes: GamepadAxes;
  readonly buttons: GamepadButtons;
  /** Bottoni premuti in questo frame (rilevamento fronte). */
  readonly justPressed: ReadonlySet<keyof GamepadButtons>;
  /** Bottoni rilasciati in questo frame. */
  readonly justReleased: ReadonlySet<keyof GamepadButtons>;
}

export interface GamepadAdapterOptions {
  /** Deflessione minima dell'asse da registrare (0..1). Default 0.12. */
  readonly deadZone?: number;
}

// ── Standard Gamepad layout (indici) ─────────────────────────────────────────

const BTN = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5,
  LT: 6, RT: 7,
  SELECT: 8, START: 9,
  L3: 10, R3: 11,
  DUP: 12, DDOWN: 13, DLEFT: 14, DRIGHT: 15,
} as const;

const AXES = {
  LX: 0, LY: 1,
  RX: 2, RY: 3,
} as const;

// ── Implementazione ───────────────────────────────────────────────────────────

export class GamepadAdapter {
  private readonly deadZone: number;
  private prevDigital: Partial<Record<keyof GamepadButtons, boolean>> = {};
  private _state: GamepadState = makeEmptyState();

  constructor(options: GamepadAdapterOptions = {}) {
    this.deadZone = options.deadZone ?? 0.12;
    window.addEventListener('gamepadconnected', this.onConnected);
    window.addEventListener('gamepaddisconnected', this.onDisconnected);
  }

  get state(): GamepadState {
    return this._state;
  }

  /**
   * Eseguire una volta per frame (prima di leggere lo stato).
   * Non usa performance.now() — l'intervallo di polling è gestito dal game loop.
   */
  poll(): void {
    const gamepads = navigator.getGamepads();
    const gp = gamepads.find((g) => g !== null) ?? null;

    if (!gp) {
      if (this._state.connected) {
        this._state = makeEmptyState();
        this.prevDigital = {};
      }
      return;
    }

    const dz = this.deadZone;
    const applyDead = (v: number): number => (Math.abs(v) < dz ? 0 : v);

    const axes: GamepadAxes = {
      leftX:  applyDead(gp.axes[AXES.LX] ?? 0),
      leftY:  applyDead(gp.axes[AXES.LY] ?? 0),
      rightX: applyDead(gp.axes[AXES.RX] ?? 0),
      rightY: applyDead(gp.axes[AXES.RY] ?? 0),
    };

    const b = gp.buttons;
    const pressed = (i: number): boolean => b[i]?.pressed ?? false;
    const value   = (i: number): number  => b[i]?.value   ?? 0;

    const buttons: GamepadButtons = {
      actionSouth:  pressed(BTN.A),
      actionEast:   pressed(BTN.B),
      actionWest:   pressed(BTN.X),
      actionNorth:  pressed(BTN.Y),
      leftBumper:   pressed(BTN.LB),
      rightBumper:  pressed(BTN.RB),
      leftTrigger:  value(BTN.LT),
      rightTrigger: value(BTN.RT),
      start:        pressed(BTN.START),
      select:       pressed(BTN.SELECT),
      dpadUp:       pressed(BTN.DUP),
      dpadDown:     pressed(BTN.DDOWN),
      dpadLeft:     pressed(BTN.DLEFT),
      dpadRight:    pressed(BTN.DRIGHT),
      leftStick:    pressed(BTN.L3),
      rightStick:   pressed(BTN.R3),
    };

    // Rilevamento fronte (edge detection)
    const justPressed  = new Set<keyof GamepadButtons>();
    const justReleased = new Set<keyof GamepadButtons>();
    for (const k of Object.keys(buttons) as (keyof GamepadButtons)[]) {
      // typeof restringe già il tipo: nessuna asserzione necessaria.
      const raw = buttons[k];
      const cur = typeof raw === 'boolean' ? raw : raw > 0.5;
      const prev = this.prevDigital[k] ?? false;
      if (cur && !prev) justPressed.add(k);
      if (!cur && prev) justReleased.add(k);
      this.prevDigital[k] = cur;
    }

    this._state = {
      connected: true,
      id: gp.id,
      axes,
      buttons,
      justPressed,
      justReleased,
    };
  }

  /**
   * Attiva il rumble (se supportato).
   * @param strongMagnitude 0..1 motore bassa frequenza.
   * @param weakMagnitude   0..1 motore alta frequenza.
   * @param durationMs      Durata in millisecondi.
   * @returns true se il rumble è stato avviato.
   */
  async rumble(
    strongMagnitude: number,
    weakMagnitude: number,
    durationMs: number,
  ): Promise<boolean> {
    const gp = navigator.getGamepads().find((g) => g !== null) ?? null;
    if (!gp) return false;
    interface VibrationActuator {
      playEffect(type: string, params: object): Promise<string>;
    }
    const actuator = (gp as unknown as { vibrationActuator?: VibrationActuator })
      .vibrationActuator;
    if (!actuator) return false;
    try {
      await actuator.playEffect('dual-rumble', {
        startDelay: 0,
        duration: durationMs,
        weakMagnitude:   Math.max(0, Math.min(1, weakMagnitude)),
        strongMagnitude: Math.max(0, Math.min(1, strongMagnitude)),
      });
      return true;
    } catch {
      return false;
    }
  }

  dispose(): void {
    window.removeEventListener('gamepadconnected', this.onConnected);
    window.removeEventListener('gamepaddisconnected', this.onDisconnected);
  }

  private readonly onConnected = (e: GamepadEvent): void => {
    log.debug(`Gamepad connesso: ${e.gamepad.id}`);
  };

  private readonly onDisconnected = (e: GamepadEvent): void => {
    log.debug(`Gamepad disconnesso: ${e.gamepad.id}`);
    this._state = makeEmptyState();
    this.prevDigital = {};
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmptyState(): GamepadState {
  return {
    connected: false,
    id: '',
    axes: { leftX: 0, leftY: 0, rightX: 0, rightY: 0 },
    buttons: {
      actionSouth: false, actionEast: false, actionWest: false, actionNorth: false,
      leftBumper: false, rightBumper: false,
      leftTrigger: 0, rightTrigger: 0,
      start: false, select: false,
      dpadUp: false, dpadDown: false, dpadLeft: false, dpadRight: false,
      leftStick: false, rightStick: false,
    },
    justPressed:  new Set(),
    justReleased: new Set(),
  };
}
