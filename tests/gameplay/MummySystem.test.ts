import { describe, expect, it } from 'vitest';
import {
  createMummy,
  tickMummy,
  wakeMummy,
  rotateMummyToward,
  applyLightRecoil,
  MUMMY_STATS,
} from '@/gameplay/enemies/MummySystem.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';

describe('MummySystem', () => {
  it('creata in stato SLEEPING', () => {
    const m = createMummy(1 as EntityId);
    expect(m.state).toBe('SLEEPING');
    expect(m.healthHp).toBe(MUMMY_STATS.healthHp);
  });

  it('wakeMummy transisce a WAKING', () => {
    const m = createMummy(1 as EntityId);
    const ok = wakeMummy(m);
    expect(ok).toBe(true);
    expect(m.state).toBe('WAKING');
  });

  it('wakeMummy rifiutata se non SLEEPING', () => {
    const m = createMummy(1 as EntityId);
    wakeMummy(m);
    expect(wakeMummy(m)).toBe(false);
  });

  it('WAKING → IDLE dopo wakeDurationTicks', () => {
    const m = createMummy(1 as EntityId);
    wakeMummy(m);
    for (let i = 0; i < MUMMY_STATS.wakeDurationTicks; i++) tickMummy(m);
    expect(m.state).toBe('IDLE');
  });

  it('rotazione limitata a maxRotationDegPerTick', () => {
    const m = createMummy(1 as EntityId);
    m.currentRotationDeg = 0;
    rotateMummyToward(m, 100); // richiede 100° ma cap è 1°/tick
    expect(m.currentRotationDeg).toBe(MUMMY_STATS.maxRotationDegPerTick);
  });

  it('rotazione negativa limitata', () => {
    const m = createMummy(1 as EntityId);
    m.currentRotationDeg = 50;
    rotateMummyToward(m, -100);
    expect(m.currentRotationDeg).toBe(50 - MUMMY_STATS.maxRotationDegPerTick);
  });

  it('lightRecoil rispetta cooldown', () => {
    const m = createMummy(1 as EntityId);
    expect(applyLightRecoil(m)).toBe(true);
    expect(m.lightRecoilCooldownTicks).toBe(MUMMY_STATS.lightRecoilCooldownTicks);
    expect(applyLightRecoil(m)).toBe(false);
  });

  it('tick decrementa lightRecoilCooldownTicks', () => {
    const m = createMummy(1 as EntityId);
    applyLightRecoil(m);
    tickMummy(m);
    expect(m.lightRecoilCooldownTicks).toBe(MUMMY_STATS.lightRecoilCooldownTicks - 1);
  });
});
