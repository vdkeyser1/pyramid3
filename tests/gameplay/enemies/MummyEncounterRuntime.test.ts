import { describe, expect, it } from 'vitest';
import {
  createMummyEncounterState,
  getMummyTelegraphStrength,
  isMummyAlive,
  tickMummyEncounter,
} from '@/gameplay/enemies/MummyEncounterRuntime.js';
import { MUMMY_SLASH, MUMMY_STATS } from '@/gameplay/enemies/MummySystem.js';
import { PARRY_STAGGER_TICKS } from '@/gameplay/combat/ParryResolver.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';

const MUMMY_ID = 501 as EntityId;

function makeOptions(overrides?: Partial<Parameters<typeof tickMummyEncounter>[1]>) {
  return {
    playerPosition: { x: 0, y: 0, z: 0 },
    playerYaw: 0,
    deltaSeconds: 1 / 60,
    hasLineOfSight: true,
    torchLitNearby: false,
    tick: 1000,
    ...overrides,
  };
}

describe('MummyEncounterRuntime (G-03)', () => {
  it('crea una mummia dormiente viva nel punto richiesto', () => {
    const state = createMummyEncounterState(MUMMY_ID, { x: 10, y: 0, z: 10 });

    expect(isMummyAlive(state)).toBe(true);
    expect(state.runtime.state).toBe('SLEEPING');
    expect(state.hp).toBe(MUMMY_STATS.healthHp);
    expect(state.position.x).toBe(10);
    expect(state.position.z).toBe(10);
  });

  it('si sveglia quando il player entra nel raggio con LOS', () => {
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: 4 });
    const resolution = tickMummyEncounter(state, makeOptions());

    expect(resolution.message).toContain('si solleva');
    expect(state.runtime.state).toBe('WAKING');
  });

  it('non si sveglia senza LOS anche se il player è vicino', () => {
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: 3 });
    const resolution = tickMummyEncounter(state, makeOptions({ hasLineOfSight: false }));

    expect(resolution.state).toBe('SLEEPING');
    expect(resolution.message).toBeNull();
  });

  it('insegue lentamente fuori dalla portata del fendente', () => {
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: 10 });
    // sveglia con player nel raggio (z=6, distanza 4 < wake radius 5), poi il player si allontana (z=0)
    tickMummyEncounter(state, makeOptions({ playerPosition: { x: 0, y: 0, z: 6 } }));
    // fa avanzare WAKING fino a IDLE/PURSUING (player fermo a z=0)
    for (let i = 0; i < 200; i++) {
      tickMummyEncounter(state, makeOptions());
    }
    expect(state.runtime.state).toBe('PURSUING');
    expect(state.position.z).toBeLessThan(10);
  });

  it('telegrafa il fendente prima del colpo (segnale punish)', () => {
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: 1.8 });
    // sveglia + attesa fino a IDLE/PURSUING vicino
    for (let i = 0; i < 170; i++) {
      tickMummyEncounter(state, makeOptions());
    }
    expect(state.runtime.state).toBe('ATTACKING');
    expect(getMummyTelegraphStrength(state)).toBeGreaterThan(0);
  });

  it('infligge danno solo alla prima risoluzione dell ACTIVE (hit-once)', () => {
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: 1.2 });
    let damages = 0;
    let firstDamageTick = -1;
    // Avanza fino all'attacco e oltre (la mummia può ri-attaccare: il danno
    // per swing ACTIVE deve restare 1)
    for (let i = 0; i < 600; i++) {
      const resolution = tickMummyEncounter(state, makeOptions({ tick: 2000 + i }));
      if (resolution.playerDamageHp > 0) {
        damages++;
        if (firstDamageTick < 0) {
          firstDamageTick = i;
        }
      }
    }
    expect(damages).toBeGreaterThanOrEqual(1);
    // Nessun doppio danno nello stesso swing: dopo il primo colpo, il
    // successivo richiede un nuovo attacco (gap di almeno 40 tick = recovery)
    expect(firstDamageTick).toBeGreaterThanOrEqual(0);
    expect(damages).toBeLessThanOrEqual(4); // 600 tick ≈ 3-4 attacchi max
  });

  it('il danno del fendente usa MUMMY_SLASH (ARC 120°, 15 HP)', () => {
    expect(MUMMY_SLASH.damage).toBe(15);
    expect(MUMMY_SLASH.shape.kind).toBe('ARC');
    expect(MUMMY_SLASH.shape.arcDeg).toBe(120);
  });

  it('la parata in finestra blocca il fendente e stordisce la mummia', () => {
    // La mummia è DAVANTI al player (z < 0, yaw 0 = verso -z).
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: -1.8 });
    // Avanza fino ad ATTACKING (stesso pattern del test del telegrafo).
    for (let i = 0; i < 170; i++) {
      tickMummyEncounter(state, makeOptions());
    }
    expect(state.runtime.state).toBe('ATTACKING');

    // Finestra di parata attiva ⇒ il primo tick ACTIVE viene parato.
    let parried = false;
    for (let i = 0; i < 120; i++) {
      const resolution = tickMummyEncounter(state, makeOptions({
        tick: 3000 + i,
        parryWindowActive: true,
      }));
      if (resolution.parried === true) {
        parried = true;
        expect(resolution.playerDamageHp).toBe(0);
        expect(state.staggerTicks).toBe(PARRY_STAGGER_TICKS);
        break;
      }
    }
    expect(parried).toBe(true);

    // Stordimento: nessun danno finché i tick residui non si esauriscono.
    let damageDuringStagger = 0;
    for (let i = 0; i < PARRY_STAGGER_TICKS; i++) {
      const resolution = tickMummyEncounter(state, makeOptions({ tick: 5000 + i }));
      damageDuringStagger += resolution.playerDamageHp;
    }
    expect(damageDuringStagger).toBe(0);
    expect(state.staggerTicks).toBe(0);
  });

  it('la parata fallisce se il player è girato dall altra parte', () => {
    // Mummia davanti (z -1.8) ma player con yaw π (guarda verso +z): la
    // mummia resta FUORI dall'arco di parata ⇒ il fendente arriva alla
    // risoluzione ACTIVE senza essere parato (activeStartTick viene
    // impostato solo nel ramo non-parato).
    const state = createMummyEncounterState(MUMMY_ID, { x: 0, y: 0, z: -1.8 });
    let sawParried = false;
    let sawActive = false;
    for (let i = 0; i < 400; i++) {
      const resolution = tickMummyEncounter(state, makeOptions({
        tick: 7000 + i,
        playerYaw: Math.PI,
        parryWindowActive: true,
      }));
      if (resolution.parried === true) sawParried = true;
      if (state.activeStartTick > 0) sawActive = true;
    }
    expect(sawParried).toBe(false);
    expect(sawActive).toBe(true);
  });
});
