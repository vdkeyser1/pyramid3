import { describe, expect, it } from 'vitest';
import {
  createTorch,
  tickTorch,
  applyTorchCommand,
  type TorchRuntime,
} from '@/gameplay/torch/TorchSystem.js';
import { TORCH, TICK_HZ } from '@/content/balance.js';

describe('TorchSystem', () => {
  it('crea torcia OFF con combustibile pieno', () => {
    const t = createTorch();
    expect(t.state).toBe('OFF');
    expect(t.fuelSeconds).toBe(TORCH.initialFuelSeconds);
  });

  it('TOGGLE accende la torcia', () => {
    const t = createTorch();
    const { runtime } = applyTorchCommand(t, { kind: 'TOGGLE' });
    expect(runtime.state).toBe('HIGH');
  });

  it('TOGGLE spegne la torcia accesa', () => {
    const t = createTorch();
    const { runtime: lit } = applyTorchCommand(t, { kind: 'TOGGLE' });
    const { runtime: off } = applyTorchCommand(lit, { kind: 'TOGGLE' });
    expect(off.state).toBe('OFF');
  });

  it('TOGGLE non funziona senza combustibile', () => {
    const t: TorchRuntime = { ...createTorch(), fuelSeconds: 0 };
    const { changed } = applyTorchCommand(t, { kind: 'TOGGLE' });
    expect(changed).toBe(false);
  });

  it('stato OFF non consuma combustibile', () => {
    const t = createTorch();
    const { runtime } = tickTorch(t);
    expect(runtime.fuelSeconds).toBe(t.fuelSeconds);
  });

  it('stato HIGH consuma combustibile', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH' };
    const { runtime } = tickTorch(t);
    expect(runtime.fuelSeconds).toBeLessThan(t.fuelSeconds);
  });

  it('esaurimento combustibile → OFF + effetto FUEL_EMPTY', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', fuelSeconds: 0.001 };
    const { runtime, effects } = tickTorch(t);
    expect(runtime.state).toBe('OFF');
    expect(runtime.fuelSeconds).toBe(0);
    expect(effects.some((e) => e.kind === 'FUEL_EMPTY')).toBe(true);
  });

  it('attraversando la soglia critica emette FUEL_LOW una sola volta', () => {
    const thresholdEdge = 15 + TORCH.drainRatioByState.HIGH / TICK_HZ / 2;
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', fuelSeconds: thresholdEdge };
    const firstTick = tickTorch(t);
    expect(firstTick.effects).toEqual([{ kind: 'FUEL_LOW', intensity: 1 }]);

    const secondTick = tickTorch(firstTick.runtime);
    expect(secondTick.effects.some((e) => e.kind === 'FUEL_LOW')).toBe(false);
  });

  it('WAVE richiede fiamma accesa', () => {
    const t = createTorch(); // OFF
    const { changed } = applyTorchCommand(t, { kind: 'WAVE' });
    expect(changed).toBe(false);
  });

  it('WAVE in cooldown viene rifiutata', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', waveCooldownTicks: 10 };
    const { changed } = applyTorchCommand(t, { kind: 'WAVE' });
    expect(changed).toBe(false);
  });

  it('WAVE riuscita setta durata e cooldown', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH' };
    const { runtime, effects } = applyTorchCommand(t, { kind: 'WAVE' });
    expect(runtime.waveActiveTicks).toBe(TORCH.waveDurationTicks);
    expect(runtime.waveCooldownTicks).toBe(TORCH.waveCooldownTicks);
    expect(effects.some((e) => e.kind === 'LIGHT_PULSE')).toBe(true);
  });

  it('PLACE → PLACED, PICK_UP → HIGH', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH' };
    const { runtime: placed } = applyTorchCommand(t, { kind: 'PLACE' });
    expect(placed.state).toBe('PLACED');
    const { runtime: picked } = applyTorchCommand(placed, { kind: 'PICK_UP' });
    expect(picked.state).toBe('HIGH');
  });

  it('IGNITE_BRAZIER consuma combustibile', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH' };
    const { runtime, effects } = applyTorchCommand(t, { kind: 'IGNITE_BRAZIER', brazierId: 'b1' });
    expect(runtime.fuelSeconds).toBe(t.fuelSeconds - TORCH.brazierIgnitionCostSeconds);
    expect(effects.some((e) => e.kind === 'BRAZIER_LIT')).toBe(true);
  });

  it('REFILL_FROM_BRAZIER ricarica fino a cap', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', fuelSeconds: 50 };
    const { runtime } = applyTorchCommand(t, { kind: 'REFILL_FROM_BRAZIER', brazierId: 'b1' });
    expect(runtime.fuelSeconds).toBe(50 + TORCH.brazierRefillCapSeconds);
    expect(runtime.usedBrazierIds).toContain('b1');
  });

  it('REFILL_FROM_BRAZIER usato due volte → rifiutato', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', fuelSeconds: 50 };
    const { runtime: r1 } = applyTorchCommand(t, { kind: 'REFILL_FROM_BRAZIER', brazierId: 'b1' });
    const { changed } = applyTorchCommand(r1, { kind: 'REFILL_FROM_BRAZIER', brazierId: 'b1' });
    expect(changed).toBe(false);
  });

  it('KA_ECHO consuma 3s, setta cooldown 12s, rumore 4.0', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH' };
    const { runtime, effects } = applyTorchCommand(t, { kind: 'KA_ECHO' });
    expect(runtime.fuelSeconds).toBe(t.fuelSeconds - TORCH.kaEchoCostSeconds);
    expect(runtime.kaEchoCooldownTicks).toBe(TORCH.kaEchoCooldownTicks);
    expect(runtime.kaEchoActiveTicks).toBe(TORCH.kaEchoDurationTicks);
    expect(effects.find((e) => e.kind === 'NOISE')?.intensity).toBe(4);
  });

  it('KA_ECHO rifiutato in cooldown', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', kaEchoCooldownTicks: 100 };
    const { changed } = applyTorchCommand(t, { kind: 'KA_ECHO' });
    expect(changed).toBe(false);
  });

  it('KA_ECHO rifiutato con combustibile insufficiente', () => {
    const t: TorchRuntime = { ...createTorch(), state: 'HIGH', fuelSeconds: 2 };
    const { changed } = applyTorchCommand(t, { kind: 'KA_ECHO' });
    expect(changed).toBe(false);
  });

  it('tick decrementa cooldown', () => {
    const t: TorchRuntime = {
      ...createTorch(),
      state: 'OFF',
      waveCooldownTicks: 5,
      kaEchoCooldownTicks: 10,
      waveActiveTicks: 3,
      kaEchoActiveTicks: 7,
    };
    const { runtime } = tickTorch(t);
    expect(runtime.waveCooldownTicks).toBe(4);
    expect(runtime.kaEchoCooldownTicks).toBe(9);
    expect(runtime.waveActiveTicks).toBe(2);
    expect(runtime.kaEchoActiveTicks).toBe(6);
  });
});
