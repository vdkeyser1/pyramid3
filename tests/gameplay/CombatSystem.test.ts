import { describe, expect, it } from 'vitest';
import {
  createCombatState,
  startAttack,
  tickCombatState,
  canApplyHeavyStun,
  isInNewRoomGrace,
} from '@/gameplay/combat/CombatSystem.js';
import type { AttackDefinition } from '@/gameplay/combat/AttackDefinition.js';
import { COMBAT } from '@/content/balance.js';

const MOCK_ATTACK: AttackDefinition = {
  id: 'test_slash',
  anticipationTicks: 10,
  activeTicks: 5,
  recoveryTicks: 8,
  damage: 15,
  stagger: 0.5,
  shape: { kind: 'ARC', radiusM: 1.5, arcDeg: 90 },
  interruptibleUntilTick: 5,
  audioCue: 'test',
  effectCue: 'test',
  punishWindowTicks: 8,
  parryable: true,
  knockbackDirectionLocal: { x: 0, z: -1 },
  knockbackForce: 1,
};

describe('CombatSystem', () => {
  it('stato iniziale READY', () => {
    const state = createCombatState();
    expect(state.phase).toBe('READY');
    expect(state.currentAttack).toBeNull();
  });

  it('startAttack transisce a ANTICIPATION', () => {
    const state = createCombatState();
    const ok = startAttack(state, MOCK_ATTACK);
    expect(ok).toBe(true);
    expect(state.phase).toBe('ANTICIPATION');
  });

  it('startAttack rifiutato fuori da READY', () => {
    const state = createCombatState();
    startAttack(state, MOCK_ATTACK);
    const ok = startAttack(state, MOCK_ATTACK);
    expect(ok).toBe(false);
  });

  it('grammatica completa READY→ANT→ACTIVE→RECOVERY→READY', () => {
    const state = createCombatState();
    startAttack(state, MOCK_ATTACK);

    // ANTICIPATION per 10 tick
    for (let i = 0; i < 10; i++) tickCombatState(state, i);
    expect(state.phase).toBe('ACTIVE');

    // ACTIVE per 5 tick
    for (let i = 0; i < 5; i++) tickCombatState(state, 10 + i);
    expect(state.phase).toBe('RECOVERY');

    // RECOVERY per 8 tick
    for (let i = 0; i < 8; i++) tickCombatState(state, 15 + i);
    expect(state.phase).toBe('READY');
    expect(state.currentAttack).toBeNull();
  });

  it('canApplyHeavyStun rispetta intervallo minimo', () => {
    const state = createCombatState();
    state.lastHeavyStunTick = 0;
    const minInterval = Math.round(COMBAT.maxHeavyHitStunPerSecond * 60);
    expect(canApplyHeavyStun(state, minInterval - 1)).toBe(false);
    expect(canApplyHeavyStun(state, minInterval)).toBe(true);
  });

  it('isInNewRoomGrace attiva per 2.0 s', () => {
    expect(isInNewRoomGrace(0, 0)).toBe(true);
    expect(isInNewRoomGrace(0, COMBAT.newRoomGraceTicks - 1)).toBe(true);
    expect(isInNewRoomGrace(0, COMBAT.newRoomGraceTicks)).toBe(false);
  });
});
