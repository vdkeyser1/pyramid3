import { describe, expect, it } from 'vitest';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import { collectAttackHits } from '@/gameplay/combat/AttackHitResolver.js';
import type { AttackDefinition } from '@/gameplay/combat/AttackDefinition.js';
import { HurtboxStore } from '@/gameplay/combat/HurtboxStore.js';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';

const ARC_ATTACK: AttackDefinition = {
  id: 'arc_slash',
  anticipationTicks: 1,
  activeTicks: 2,
  recoveryTicks: 3,
  damage: 10,
  stagger: 0.3,
  shape: { kind: 'ARC', radiusM: 1.8, arcDeg: 120 },
  interruptibleUntilTick: 0,
  audioCue: '',
  effectCue: '',
  punishWindowTicks: 0,
  parryable: true,
  knockbackDirectionLocal: { x: 0, z: -1 },
  knockbackForce: 1,
};

const LINE_ATTACK: AttackDefinition = {
  ...ARC_ATTACK,
  id: 'line_thrust',
  shape: { kind: 'LINE', radiusM: 0.4, lengthM: 2.4 },
};

function createStore(): HurtboxStore {
  const store = new HurtboxStore();
  store.add({
    entityId: 2 as EntityId,
    centerX: 0,
    centerY: 1,
    centerZ: -1.2,
    radiusM: 0.4,
    heightM: 1.8,
  });
  store.add({
    entityId: 3 as EntityId,
    centerX: 1.8,
    centerY: 1,
    centerZ: 0.2,
    radiusM: 0.35,
    heightM: 1.6,
  });
  return store;
}

describe('AttackHitResolver', () => {
  it('colpisce la hurtbox frontale entro l arco', () => {
    const hits = collectAttackHits({
      attackerId: 1 as EntityId,
      attack: ARC_ATTACK,
      attackerPose: { x: 0, y: 1, z: 0, yaw: 0 },
      hurtboxes: createStore(),
      activeStartTick: 100,
      hitRegistry: new HitRegistry(),
    });

    expect(hits).toEqual([2]);
  });

  it('la stessa fase ACTIVE non registra due volte lo stesso target', () => {
    const registry = new HitRegistry();
    const query = {
      attackerId: 1 as EntityId,
      attack: ARC_ATTACK,
      attackerPose: { x: 0, y: 1, z: 0, yaw: 0 },
      hurtboxes: createStore(),
      activeStartTick: 100,
      hitRegistry: registry,
    } as const;

    expect(collectAttackHits(query)).toEqual([2]);
    expect(collectAttackHits(query)).toEqual([]);
  });

  it('lo stesso target torna colpibile in uno swing ACTIVE diverso', () => {
    const registry = new HitRegistry();
    const store = createStore();

    collectAttackHits({
      attackerId: 1 as EntityId,
      attack: ARC_ATTACK,
      attackerPose: { x: 0, y: 1, z: 0, yaw: 0 },
      hurtboxes: store,
      activeStartTick: 100,
      hitRegistry: registry,
    });

    const hits = collectAttackHits({
      attackerId: 1 as EntityId,
      attack: ARC_ATTACK,
      attackerPose: { x: 0, y: 1, z: 0, yaw: 0 },
      hurtboxes: store,
      activeStartTick: 120,
      hitRegistry: registry,
    });

    expect(hits).toEqual([2]);
  });

  it('la shape LINE colpisce solo sul corridoio frontale', () => {
    const store = new HurtboxStore();
    store.add({
      entityId: 2 as EntityId,
      centerX: 0.15,
      centerY: 1,
      centerZ: -2.1,
      radiusM: 0.25,
      heightM: 1.8,
    });
    store.add({
      entityId: 3 as EntityId,
      centerX: 1.3,
      centerY: 1,
      centerZ: -1.4,
      radiusM: 0.25,
      heightM: 1.8,
    });

    const hits = collectAttackHits({
      attackerId: 1 as EntityId,
      attack: LINE_ATTACK,
      attackerPose: { x: 0, y: 1, z: 0, yaw: 0 },
      hurtboxes: store,
      activeStartTick: 90,
      hitRegistry: new HitRegistry(),
    });

    expect(hits).toEqual([2]);
  });

  it('rispetta il filtro di line of sight', () => {
    const hits = collectAttackHits({
      attackerId: 1 as EntityId,
      attack: ARC_ATTACK,
      attackerPose: { x: 0, y: 1, z: 0, yaw: 0 },
      hurtboxes: createStore(),
      activeStartTick: 100,
      hitRegistry: new HitRegistry(),
      hasLineOfSight: (entry) => entry.entityId !== (2 as EntityId),
    });

    expect(hits).toEqual([]);
  });
});
