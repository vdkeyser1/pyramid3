import { describe, expect, it } from 'vitest';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import { resolveEnemyAttackHitsPlayer, createPlayerHurtbox } from '@/gameplay/combat/EnemyAttackResolver.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';

const ENEMY_ID = 101 as EntityId;

function arcAttack(radiusM = 2.0, arcDeg = 90): import('@/gameplay/combat/AttackDefinition.js').AttackDefinition {
  return {
    id: 'test-arc',
    anticipationTicks: 20,
    activeTicks: 10,
    recoveryTicks: 20,
    damage: 10,
    stagger: 5,
    shape: { kind: 'ARC', radiusM, arcDeg },
    interruptibleUntilTick: 0,
    audioCue: 'attack_swing',
    effectCue: 'vfx_slash_trail',
    punishWindowTicks: 10,
    parryable: true,
    knockbackDirectionLocal: { x: 0, z: -1 },
    knockbackForce: 2,
  };
}

function sphereAttack(radiusM = 1.5): import('@/gameplay/combat/AttackDefinition.js').AttackDefinition {
  return {
    id: 'test-sphere',
    anticipationTicks: 20,
    activeTicks: 10,
    recoveryTicks: 20,
    damage: 10,
    stagger: 5,
    shape: { kind: 'SPHERE', radiusM },
    interruptibleUntilTick: 0,
    audioCue: 'attack_swing',
    effectCue: 'vfx_slash_trail',
    punishWindowTicks: 10,
    parryable: false,
    knockbackDirectionLocal: { x: 0, z: -1 },
    knockbackForce: 2,
  };
}

function hitOnPlayer(
  attack: import('@/gameplay/combat/AttackDefinition.js').AttackDefinition,
  enemy: { x: number; y: number; z: number; yaw: number },
  player: { x: number; y: number; z: number },
  registry = new HitRegistry(),
): boolean {
  return resolveEnemyAttackHitsPlayer({
    attackerId: ENEMY_ID,
    attack,
    attackerPose: enemy,
    player,
    activeStartTick: 1000,
    hitRegistry: registry,
  });
}

describe('EnemyAttackResolver (G-03)', () => {
  it('colpisce il giocatore dentro la reach dell arco frontale', () => {
    const hit = hitOnPlayer(
      arcAttack(2.0, 90),
      { x: 0, y: 0, z: 0, yaw: 0 },
      { x: 0, y: 0, z: -1.5 }, // davanti (yaw 0 = -Z)
    );
    expect(hit).toBe(true);
  });

  it('manca il giocatore dietro (fuori dall arco)', () => {
    const hit = hitOnPlayer(
      arcAttack(2.0, 90),
      { x: 0, y: 0, z: 0, yaw: 0 },
      { x: 0, y: 0, z: 1.5 }, // dietro
    );
    expect(hit).toBe(false);
  });

  it('manca il giocatore fuori dalla reach', () => {
    const hit = hitOnPlayer(
      arcAttack(1.0, 120),
      { x: 0, y: 0, z: 0, yaw: 0 },
      { x: 0, y: 0, z: -3.0 }, // troppo lontano
    );
    expect(hit).toBe(false);
  });

  it('colpisce solo una volta per swing ACTIVE (hit-once)', () => {
    const registry = new HitRegistry();
    const query = () =>
      hitOnPlayer(
        sphereAttack(1.5),
        { x: 0, y: 0, z: 0, yaw: 0 },
        { x: 0.5, y: 0, z: 0 },
        registry,
      );

    expect(query()).toBe(true);
    expect(query()).toBe(false); // stesso activeStartTick
  });

  it('la hurtbox del player è una capsula con i parametri di bilancio', () => {
    const hurtbox = createPlayerHurtbox({ x: 1, y: 0, z: 2 });
    expect(hurtbox.radiusM).toBe(0.32);
    expect(hurtbox.heightM).toBe(1.75);
    expect(hurtbox.centerY).toBeCloseTo(0.875);
  });
});
