import { describe, expect, it } from 'vitest';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import {
  applyDamageToScarab,
  createScarabEncounterState,
  getScarabTelegraphStrength,
  tickScarabEncounter,
} from '@/gameplay/enemies/ScarabEncounterRuntime.js';
import { SCARAB_STATS } from '@/gameplay/enemies/ScarabSystem.js';

describe('ScarabEncounterRuntime', () => {
  it('si risveglia quando il player entra nel raggio visivo', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });
    const tick = tickScarabEncounter(scarab, {
      playerPosition: { x: 2, y: 0, z: 0 },
      deltaSeconds: 1 / 60,
      hasLineOfSight: true,
    });

    expect(scarab.awakened).toBe(true);
    expect(tick.message).toContain('emerge');
  });

  it('prepara una carica quando il player e vicino', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });
    scarab.awakened = true;

    const tick = tickScarabEncounter(scarab, {
      playerPosition: { x: 1.5, y: 0, z: 0 },
      deltaSeconds: 1 / 60,
      hasLineOfSight: true,
    });

    expect(scarab.runtime.state).toBe('CHARGING_TELL');
    expect(tick.message).toContain('prepara la carica');
    expect(getScarabTelegraphStrength(scarab)).toBe(0);
  });

  it('infligge danno durante la fase CHARGING', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });
    scarab.awakened = true;
    scarab.runtime.state = 'CHARGING';
    scarab.chargeDirectionX = 1;
    scarab.chargeDirectionZ = 0;

    const tick = tickScarabEncounter(scarab, {
      playerPosition: { x: 0.25, y: 0, z: 0 },
      deltaSeconds: 1 / 60,
      hasLineOfSight: true,
    });

    expect(tick.playerDamageHp).toBeGreaterThan(0);
    expect(tick.message).toContain('investe');
  });

  it('usa la torcia posata come attrattore in approach', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });
    scarab.awakened = true;

    tickScarabEncounter(scarab, {
      playerPosition: { x: 8, y: 0, z: 0 },
      deltaSeconds: 1 / 60,
      hasLineOfSight: false,
      torchAttractor: { x: 2, y: 0.02, z: 0 },
    });

    expect(scarab.position.x).toBeGreaterThan(0);
    expect(scarab.position.x).toBeLessThan(2);
  });

  it('si risveglia anche su un rumore vicino senza linea visiva', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });

    const tick = tickScarabEncounter(scarab, {
      playerPosition: { x: 8, y: 0, z: 0 },
      deltaSeconds: 1 / 60,
      hasLineOfSight: false,
      noiseAttractor: { x: 2, y: 0.02, z: 0 },
    });

    expect(scarab.awakened).toBe(true);
    expect(tick.message).toContain('rumore');
  });

  it('insegue il rumore quando non vede il player', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });
    scarab.awakened = true;

    tickScarabEncounter(scarab, {
      playerPosition: { x: 8, y: 0, z: 0 },
      deltaSeconds: 1 / 60,
      hasLineOfSight: false,
      noiseAttractor: { x: 3, y: 0.02, z: 0 },
    });

    expect(scarab.position.x).toBeGreaterThan(0);
    expect(scarab.position.x).toBeLessThan(3);
  });

  it('muore e passa a DEAD dopo danno letale', () => {
    const scarab = createScarabEncounterState(3 as EntityId, { x: 0, y: 0.52, z: 0 });
    const resolution = applyDamageToScarab(scarab, SCARAB_STATS.healthHp);

    expect(resolution.killed).toBe(true);
    expect(scarab.runtime.state).toBe('DEAD');
    expect(scarab.hp).toBe(0);
  });
});
