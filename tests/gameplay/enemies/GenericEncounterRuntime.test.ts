import { describe, expect, it } from 'vitest';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import {
  applyDamageToGenericEnemy,
  attackDefinitionFromDef,
  createGenericEncounterState,
  getGenericTelegraphStrength,
  isGenericEnemyAlive,
  tickGenericEncounter,
  type GenericEncounterTickOptions,
} from '@/gameplay/enemies/GenericEncounterRuntime.js';
import { PARRY_STAGGER_TICKS } from '@/gameplay/combat/ParryResolver.js';

const ID = 100 as EntityId;
const PLAYER_ORIGIN = { x: 0, y: 0, z: 0 };

function makeOptions(overrides: Partial<GenericEncounterTickOptions> = {}): GenericEncounterTickOptions {
  return {
    playerPosition: PLAYER_ORIGIN,
    playerYaw: 0,
    tick: 0,
    hasLineOfSight: null,
    torchLit: false,
    ...overrides,
  };
}

describe('GenericEncounterRuntime (G-03 residuo / G-13)', () => {
  it('COBRA: si sveglia sentendo il player (hearRadius 12) anche senza LOS', () => {
    const state = createGenericEncounterState(ID, 'COBRA', { x: 0, y: 0, z: 8 });
    expect(state).not.toBeNull();
    if (state === null) return;

    expect(isGenericEnemyAlive(state)).toBe(true);
    const result = tickGenericEncounter(state, makeOptions({ hasLineOfSight: () => false }));
    expect(state.runtime.state).toBe('PURSUING');
    expect(result.message).toContain('sveglia');
  });

  it('COBRA: morso rapido con hit-once al primo tick ACTIVE', () => {
    const state = createGenericEncounterState(ID, 'COBRA', { x: 0, y: 0, z: 0.9 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (distanza 0.9 < hear)
    const hitTicks: number[] = [];
    for (let i = 0; i < 300; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: i }));
      if (result.playerDamageHp > 0) hitTicks.push(i);
    }
    // Morso: 8 HP a colpo. Hit-once ⇒ i colpi sono separati da ALMENO
    // anticipation+active+recovery tick (nessun doppio colpo nello stesso swing)
    expect(hitTicks.length).toBeGreaterThan(1); // ri-attacca nel tempo
    for (let i = 1; i < hitTicks.length; i++) {
      const prev = hitTicks[i - 1];
      const curr = hitTicks[i];
      if (prev === undefined || curr === undefined) continue;
      expect(curr - prev).toBeGreaterThan(100); // ~1.85s @60Hz, un intero swing
    }
  });

  it('SHABTI: sceglie il colpo di scettro a distanza ravvicinata', () => {
    const state = createGenericEncounterState(ID, 'SHABTI', { x: 0, y: 0, z: 2.0 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hear 10)
    // Avanza fino ad attaccare
    for (let i = 0; i < 300; i++) {
      tickGenericEncounter(state, makeOptions({ tick: i }));
      if (state.runtime.state === 'ATTACKING') break;
    }
    expect(state.runtime.state).toBe('ATTACKING');
    // Lo scettro (range 2.5) è più adatto della carica (range 8): indice 0
    expect(state.runtime.attackIndex).toBe(0);
  });

  it('ROYAL_MUMMY: il telegrafo cresce durante l anticipazione', () => {
    const state = createGenericEncounterState(ID, 'ROYAL_MUMMY', { x: 0, y: 0, z: 1.5 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hear 8)
    // Porta ad ATTACKING
    let strength = 0;
    for (let i = 0; i < 300 && state.runtime.state !== 'ATTACKING'; i++) {
      tickGenericEncounter(state, makeOptions({ tick: i }));
    }
    // Durante l'anticipazione il telegrafo sale
    const anticipationTicks = state.def.attacks[0]?.anticipationTicks ?? 48;
    for (let i = 0; i < anticipationTicks; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: i }));
      strength = result.telegraphStrength;
    }
    expect(strength).toBeGreaterThan(0.9);
  });

  it('la luce respinge ROYAL_MUMMY (torchAffinity -0.6) a distanza ravvicinata', () => {
    const state = createGenericEncounterState(ID, 'ROYAL_MUMMY', { x: 0, y: 0, z: 0.8 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions());
    const before = { ...state.position };
    let retreated = false;
    for (let i = 0; i < 120; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: i, torchLit: true }));
      if (result.message?.includes('indietreggia')) {
        retreated = true;
        break;
      }
    }
    expect(retreated).toBe(true);
    expect(state.position.z).toBeGreaterThan(before.z);
  });

  it('applyDamageToGenericEnemy uccide a 0 HP', () => {
    const state = createGenericEncounterState(ID, 'COBRA', { x: 0, y: 0, z: 10 });
    if (state === null) return;

    const first = applyDamageToGenericEnemy(state, 10);
    expect(first.hp).toBe(15);
    expect(first.killed).toBe(false);
    expect(isGenericEnemyAlive(state)).toBe(true);

    const second = applyDamageToGenericEnemy(state, 15);
    expect(second.hp).toBe(0);
    expect(second.killed).toBe(true);
    expect(isGenericEnemyAlive(state)).toBe(false);
    expect(getGenericTelegraphStrength(state)).toBe(0);
  });

  it('attackDefinitionFromDef: arcDeg >= 340 diventa SPHERE (coda di Sobek)', () => {
    const def = attackDefinitionFromDef('Colpo di Coda', {
      damageHp: 20,
      anticipationTicks: 54,
      activeTicks: 12,
      recoveryTicks: 60,
      range: 3.0,
      arcDeg: 360,
      isHeavy: false,
      stagger: 0.6,
      audioCue: 'sobek_tail',
    });
    expect(def.shape.kind).toBe('SPHERE');
    expect(def.damage).toBe(20);
    expect(def.parryable).toBe(true);

    const slash = attackDefinitionFromDef('Fendente Reale', {
      damageHp: 25,
      anticipationTicks: 48,
      activeTicks: 18,
      recoveryTicks: 60,
      range: 3.0,
      arcDeg: 140,
      isHeavy: true,
      stagger: 1.0,
      audioCue: 'royal_swing',
    });
    expect(slash.shape.kind).toBe('ARC');
    expect(slash.shape.arcDeg).toBe(140);
    expect(slash.parryable).toBe(false);
  });

  it('COBRA: la parata in finestra annulla il danno e stordisce (punish window)', () => {
    // Il cobra è DAVANTI al player (z < 0, yaw 0 = verso -z).
    const state = createGenericEncounterState(ID, 'COBRA', { x: 0, y: 0, z: -1.2 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hear 12)
    let parried = false;
    for (let i = 0; i < 300; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: i, parryWindowActive: true }));
      if (result.parried === true) {
        parried = true;
        expect(result.playerDamageHp).toBe(0);
        expect(state.runtime.state).toBe('STAGGERED');
        expect(state.runtime.staggerTicks).toBeGreaterThan(0);
        break;
      }
    }
    expect(parried).toBe(true);

    // Durante lo stordimento: nessun danno, nessun ri-attacco.
    let damageDuringStagger = 0;
    for (let i = 0; i < PARRY_STAGGER_TICKS; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: 1000 + i }));
      damageDuringStagger += result.playerDamageHp;
      expect(state.runtime.state).not.toBe('ATTACKING');
    }
    expect(damageDuringStagger).toBe(0);
    expect(state.runtime.state).toBe('PURSUING'); // stordimento esaurito
  });

  it('SHABTI: gli attacchi pesanti NON sono parabili', () => {
    const state = createGenericEncounterState(ID, 'SHABTI', { x: 0, y: 0, z: 2.0 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hear 10)
    let sawParried = false;
    let sawDamage = false;
    for (let i = 0; i < 600; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: i, parryWindowActive: true }));
      if (result.parried === true) sawParried = true;
      if (result.playerDamageHp > 0) sawDamage = true;
    }
    expect(sawParried).toBe(false);
    expect(sawDamage).toBe(true);
  });

  it('SOBEK: la parata fallisce se il nemico è alle spalle (ma l attacco arriva)', () => {
    // Sobek DIETRO il player (z +2.8, yaw 0 = verso -z): fuori dall'arco di
    // parata (90° > 50°). 'Colpo di Coda' è SPHERE (arcDeg 360) ⇒ colpisce
    // sempre, indipendentemente dall'allineamento del nemico.
    const state = createGenericEncounterState(ID, 'SOBEK_SPAWN', { x: 0, y: 0, z: 2.8 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hear 6)
    let sawParried = false;
    let sawDamage = false;
    for (let i = 0; i < 400; i++) {
      const result = tickGenericEncounter(state, makeOptions({ tick: i, parryWindowActive: true }));
      if (result.parried === true) sawParried = true;
      if (result.playerDamageHp > 0) sawDamage = true;
    }
    expect(sawParried).toBe(false);
    expect(sawDamage).toBe(true);
  });

  it('A-01: il rumore sveglia un archetipo dormiente anche senza LOS né player vicino', () => {
    // COBRA a 30m (fuori da wake radius 5 e hear radius 12): un forte rumore
    // a 9m (dentro 12 × (0.6+0.4×1.0) = 12m) lo sveglia.
    const state = createGenericEncounterState(ID, 'COBRA', { x: 0, y: 0, z: 30 });
    if (state === null) return;

    const result = tickGenericEncounter(state, makeOptions({
      hasLineOfSight: () => false,
      noiseStimulus: { x: 0, z: 21, intensity: 1.0 },
    }));
    expect(state.runtime.state).toBe('PURSUING');
    expect(result.message).toContain('sveglia');
  });

  it('A-01: un rumore debole o lontano NON sveglia (rispetta il raggio)', () => {
    const state = createGenericEncounterState(ID, 'COBRA', { x: 0, y: 0, z: 30 });
    if (state === null) return;

    // Rumore a z=20 → 10m dal nemico: fuori da 12 × (0.6+0.4×0.3) = 8.64m.
    tickGenericEncounter(state, makeOptions({
      hasLineOfSight: () => false,
      noiseStimulus: { x: 0, z: 20, intensity: 0.3 },
    }));
    expect(state.runtime.state).toBe('DORMANT');
  });

  it('ROYAL_MUMMY: seleziona Maledizione dei Faraoni (indice 1) a distanza media', () => {
    // Nemico davanti al player (z=-8): distanza 8m, già allineato (facingDelta=0).
    // Fendente Reale: range 3.0m → fuori portata (8 > 3.4). Non selezionabile.
    // Maledizione dei Faraoni: range 9.0m → in portata (8 < 9.4). Selezionata.
    const state = createGenericEncounterState(ID, 'ROYAL_MUMMY', { x: 0, y: 0, z: -8.0 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hearRadius 8, distance 8 ≤ 8)
    for (let i = 0; i < 600 && state.runtime.state !== 'ATTACKING'; i++) {
      tickGenericEncounter(state, makeOptions({ tick: i }));
    }
    expect(state.runtime.state).toBe('ATTACKING');
    expect(state.runtime.attackIndex).toBe(1); // Maledizione dei Faraoni
  });

  it('ROYAL_MUMMY: seleziona Fendente Reale (indice 0) a distanza ravvicinata', () => {
    // Nemico davanti al player (z=-1.5): dentro il range del fendente (3m).
    // selectAttack preferisce il fendente (score 100-3.0=97) vs maledizione (100-9.0=91).
    const state = createGenericEncounterState(ID, 'ROYAL_MUMMY', { x: 0, y: 0, z: -1.5 });
    if (state === null) return;

    tickGenericEncounter(state, makeOptions()); // wake (hearRadius 8, distance 1.5 ≤ 8)
    for (let i = 0; i < 600 && state.runtime.state !== 'ATTACKING'; i++) {
      tickGenericEncounter(state, makeOptions({ tick: i }));
    }
    expect(state.runtime.state).toBe('ATTACKING');
    expect(state.runtime.attackIndex).toBe(0); // Fendente Reale
  });
});
