import { describe, expect, it } from 'vitest';
import {
  createScarab,
  tickScarab,
  startCharge,
  SCARAB_STATS,
} from '@/gameplay/enemies/ScarabSystem.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';

describe('ScarabSystem', () => {
  it('creato in stato IDLE', () => {
    const s = createScarab(1 as EntityId);
    expect(s.state).toBe('IDLE');
    expect(s.healthHp).toBe(SCARAB_STATS.healthHp);
  });

  it('startCharge da IDLE → CHARGING_TELL', () => {
    const s = createScarab(1 as EntityId);
    expect(startCharge(s)).toBe(true);
    expect(s.state).toBe('CHARGING_TELL');
  });

  it('startCharge rifiutata durante carica', () => {
    const s = createScarab(1 as EntityId);
    startCharge(s);
    expect(startCharge(s)).toBe(false);
  });

  it('CHARGING_TELL → CHARGING dopo chargeTellTicks', () => {
    const s = createScarab(1 as EntityId);
    startCharge(s);
    for (let i = 0; i < SCARAB_STATS.chargeTellTicks; i++) tickScarab(s);
    expect(s.state).toBe('CHARGING');
  });

  it('ciclo completo TELL → CHARGING → RECOVERING → IDLE', () => {
    const s = createScarab(1 as EntityId);
    startCharge(s);
    for (let i = 0; i < SCARAB_STATS.chargeTellTicks; i++) tickScarab(s);
    expect(s.state).toBe('CHARGING');
    for (let i = 0; i < SCARAB_STATS.chargeActiveTicks; i++) tickScarab(s);
    expect(s.state).toBe('RECOVERING');
    for (let i = 0; i < SCARAB_STATS.chargeRecoveryTicks; i++) tickScarab(s);
    expect(s.state).toBe('IDLE');
  });

  it('startCharge rifiutata in cooldown', () => {
    const s = createScarab(1 as EntityId);
    s.chargeCooldownTicks = 10;
    expect(startCharge(s)).toBe(false);
  });

  it('tick decrementa cooldown', () => {
    const s = createScarab(1 as EntityId);
    s.chargeCooldownTicks = 5;
    tickScarab(s);
    expect(s.chargeCooldownTicks).toBe(4);
  });

  it('imposta cooldown quando la carica termina', () => {
    const s = createScarab(1 as EntityId);
    startCharge(s);
    for (let i = 0; i < SCARAB_STATS.chargeTellTicks; i++) tickScarab(s);
    for (let i = 0; i < SCARAB_STATS.chargeActiveTicks; i++) tickScarab(s);
    expect(s.state).toBe('RECOVERING');
    expect(s.chargeCooldownTicks).toBe(SCARAB_STATS.chargeRecoveryTicks);
  });
});
