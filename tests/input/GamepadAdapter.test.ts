import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GamepadAdapter } from '@/input/GamepadAdapter.js';

// ── Mock navigator.getGamepads ────────────────────────────────────────────────

function makeButton(pressed: boolean, value?: number): GamepadButton {
  return { pressed, touched: pressed, value: value ?? (pressed ? 1 : 0) };
}

function makeGamepad(
  overrides: {
    axes?: number[];
    buttons?: GamepadButton[];
  } = {},
): Gamepad {
  const axes    = overrides.axes    ?? [0, 0, 0, 0];
  const buttons = overrides.buttons ?? Array.from({ length: 16 }, () => makeButton(false));
  return {
    id: 'Test Gamepad',
    index: 0,
    connected: true,
    timestamp: 0,
    mapping: 'standard',
    axes,
    buttons,
    hapticActuators: [],
    vibrationActuator: null,
  } as unknown as Gamepad;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GamepadAdapter', () => {
  let adapter: GamepadAdapter;

  beforeEach(() => {
    // happy-dom non implementa navigator.getGamepads: vi.spyOn non può spiare
    // una proprietà inesistente, quindi la definiamo prima (idempotente).
    if (!('getGamepads' in navigator)) {
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        writable: true,
        value: (): (Gamepad | null)[] => [null, null, null, null],
      });
    }
    vi.spyOn(navigator, 'getGamepads').mockReturnValue([null, null, null, null]);
    adapter = new GamepadAdapter({ deadZone: 0.1 });
  });

  afterEach(() => {
    adapter.dispose();
    vi.restoreAllMocks();
  });

  it('stato iniziale: non connesso', () => {
    adapter.poll();
    expect(adapter.state.connected).toBe(false);
    expect(adapter.state.axes.leftX).toBe(0);
  });

  it('connesso: riporta assi e pulsanti', () => {
    const gp = makeGamepad({
      axes: [0.8, -0.3, 0, 0],
      buttons: (() => {
        const b = Array.from({ length: 16 }, () => makeButton(false));
        b[0] = makeButton(true); // A = actionSouth
        return b;
      })(),
    });
    vi.spyOn(navigator, 'getGamepads').mockReturnValue([gp, null, null, null]);

    adapter.poll();
    expect(adapter.state.connected).toBe(true);
    expect(adapter.state.axes.leftX).toBeCloseTo(0.8, 3);
    expect(adapter.state.axes.leftY).toBeCloseTo(-0.3, 3);
    expect(adapter.state.buttons.actionSouth).toBe(true);
    expect(adapter.state.buttons.actionEast).toBe(false);
  });

  it('dead zone: filtra valori sotto la soglia', () => {
    const gp = makeGamepad({ axes: [0.05, -0.09, 0.11, 0] });
    vi.spyOn(navigator, 'getGamepads').mockReturnValue([gp, null, null, null]);

    adapter.poll(); // deadZone = 0.1
    expect(adapter.state.axes.leftX).toBe(0);  // 0.05 < 0.1
    expect(adapter.state.axes.leftY).toBe(0);  // 0.09 < 0.1
    expect(adapter.state.axes.rightX).toBeCloseTo(0.11, 3); // 0.11 > 0.1
  });

  it('edge detection: justPressed al primo frame premuto', () => {
    const gp = makeGamepad({
      buttons: (() => {
        const b = Array.from({ length: 16 }, () => makeButton(false));
        b[9] = makeButton(true); // START
        return b;
      })(),
    });
    vi.spyOn(navigator, 'getGamepads').mockReturnValue([null, null, null, null]);
    adapter.poll(); // frame senza gamepad

    vi.spyOn(navigator, 'getGamepads').mockReturnValue([gp, null, null, null]);
    adapter.poll();
    expect(adapter.state.justPressed.has('start')).toBe(true);
    expect(adapter.state.justReleased.has('start')).toBe(false);
  });

  it('edge detection: justReleased quando il pulsante viene rilasciato', () => {
    const gpPressed  = makeGamepad({ buttons: (() => { const b = Array.from({ length: 16 }, () => makeButton(false)); b[9] = makeButton(true); return b; })() });
    const gpReleased = makeGamepad({ buttons: Array.from({ length: 16 }, () => makeButton(false)) });

    vi.spyOn(navigator, 'getGamepads').mockReturnValue([gpPressed, null, null, null]);
    adapter.poll();
    vi.spyOn(navigator, 'getGamepads').mockReturnValue([gpReleased, null, null, null]);
    adapter.poll();

    expect(adapter.state.justReleased.has('start')).toBe(true);
    expect(adapter.state.justPressed.has('start')).toBe(false);
  });

  it('leftTrigger: valore continuo 0..1', () => {
    const gp = makeGamepad({
      buttons: (() => {
        const b = Array.from({ length: 16 }, () => makeButton(false));
        b[6] = makeButton(false, 0.75); // LT
        return b;
      })(),
    });
    vi.spyOn(navigator, 'getGamepads').mockReturnValue([gp, null, null, null]);
    adapter.poll();
    expect(adapter.state.buttons.leftTrigger).toBeCloseTo(0.75, 3);
  });
});
