/**
 * Scopo: encounter runtime data-driven per QUALSIASI archetipo combattibile
 *        (G-03 residuo + G-13 runtime). Legge EnemyDef da content/enemies e
 *        guida la FSM: DORMANT → wake → pursuit → ATTACK con telegrafo,
 *        hit-once via HitRegistry, recoil/attrazione alla torcia.
 * Ownership: gameplay/enemies. Consumato da GameApplication (follow-up del
 *        Director) e testato direttamente.
 * Invarianti:
 *   - nessun Math.random: la FSM è deterministica da input;
 *   - il danno viene risolto SOLO al primo tick ACTIVE (hit-once);
 *   - torchAffinity < 0 ⇒ la luce respinge; > 0 ⇒ la luce attira (Scarabeo).
 * Failure mode: archetipo sconosciuto o WITNESS ⇒ createGenericEncounterState
 *        ritorna null (il chiamante ignora).
 */

import { ENEMIES, type EnemyArchetype, type EnemyDef } from '@/content/enemies.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import type { AttackDefinition, AttackShapeDefinition } from '@/gameplay/combat/AttackDefinition.js';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import { HurtboxStore } from '@/gameplay/combat/HurtboxStore.js';
import { createPlayerHurtbox, resolveEnemyAttackHitsPlayer } from '@/gameplay/combat/EnemyAttackResolver.js';
import { isEnemyInParryArc, PARRY_STAGGER_TICKS } from '@/gameplay/combat/ParryResolver.js';

export const GENERIC_WAKE_RADIUS_M = 5.0;
/** Rotazione di inseguimento in gradi/secondo (comune a tutti). */
export const GENERIC_TURN_RATE_DEG_S = 60;

export type GenericEnemyRuntimeState = 'DORMANT' | 'PURSUING' | 'ATTACKING' | 'RECOVERING' | 'STAGGERED' | 'DEAD';

export interface GenericEncounterState {
  readonly entityId: EntityId;
  readonly archetype: EnemyArchetype;
  readonly def: EnemyDef;
  position: { x: number; y: number; z: number };
  facingDeg: number;
  hp: number;
  activeStartTick: number;
  runtime: {
    state: GenericEnemyRuntimeState;
    stateTicks: number;
    attackIndex: number;
    /** Tick residui di stordimento (parata): >0 ⇒ il nemico non agisce. */
    staggerTicks: number;
  };
}

export interface GenericEncounterTickOptions {
  readonly playerPosition: { readonly x: number; readonly y: number; readonly z: number };
  readonly playerYaw: number;
  readonly tick: number;
  readonly hasLineOfSight: (() => boolean) | null;
  /** La torcia è accesa e puntata? (recoil per torchAffinity < 0). */
  readonly torchLit: boolean;
  /** True se la finestra di parata del player è attiva (Parry appena premuto). */
  readonly parryWindowActive?: boolean;
  /**
   * G-04/A-01: stimolo di rumore (NOISE_PULSE/KA_ECHO_PULSE) — amplifica il
   * raggio di wake per TUTTI gli archetipi (non solo SCARAB) e attira lo
   * sguardo se il rumore è più vicino del player. intensity 0..1.
   */
  readonly noiseStimulus?: { readonly x: number; readonly z: number; readonly intensity: number } | null;
}

export interface GenericEncounterTickResult {
  readonly message: string | null;
  readonly playerDamageHp: number;
  readonly telegraphStrength: number;
  /** True se l'attacco è stato parato (danno annullato, nemico stordito). */
  readonly parried?: boolean;
}

export function createGenericEncounterState(
  entityId: EntityId,
  archetype: EnemyArchetype,
  position: { readonly x: number; readonly y: number; readonly z: number },
): GenericEncounterState | null {
  const def = ENEMIES[archetype];
  if (archetype === 'WITNESS') {
    return null;
  }
  void def;
  return {
    entityId,
    archetype,
    def,
    position: { x: position.x, y: position.y, z: position.z },
    facingDeg: 0,
    hp: def.baseHp,
    activeStartTick: 0,
    runtime: {
      state: 'DORMANT',
      stateTicks: 0,
      attackIndex: 0,
      staggerTicks: 0,
    },
  };
}

export function isGenericEnemyAlive(state: GenericEncounterState): boolean {
  return state.hp > 0 && state.runtime.state !== 'DEAD';
}

export function applyDamageToGenericEnemy(state: GenericEncounterState, damageHp: number): { hp: number; killed: boolean } {
  state.hp = Math.max(0, state.hp - damageHp);
  if (state.hp <= 0) {
    state.runtime.state = 'DEAD';
  }
  return { hp: state.hp, killed: state.hp <= 0 };
}

/** Costruisce l'AttackDefinition (shape ARC) da un AttackDef di content. */
export function attackDefinitionFromDef(attackName: string, attack: {
  readonly damageHp: number;
  readonly anticipationTicks: number;
  readonly activeTicks: number;
  readonly recoveryTicks: number;
  readonly range: number;
  readonly arcDeg: number;
  readonly isHeavy: boolean;
  readonly stagger: number;
  readonly audioCue: string;
}): AttackDefinition {
  const shape: AttackShapeDefinition = {
    kind: attack.arcDeg >= 340 ? 'SPHERE' : 'ARC',
    radiusM: attack.range,
    ...(attack.arcDeg < 340 ? { arcDeg: attack.arcDeg } : {}),
  };
  return {
    id: attackName,
    anticipationTicks: attack.anticipationTicks,
    activeTicks: attack.activeTicks,
    recoveryTicks: attack.recoveryTicks,
    damage: attack.damageHp,
    stagger: attack.stagger,
    shape,
    interruptibleUntilTick: attack.anticipationTicks,
    audioCue: attack.audioCue,
    effectCue: attack.audioCue,
    punishWindowTicks: 0,
    parryable: !attack.isHeavy,
    knockbackDirectionLocal: { x: 0, z: 1 },
    knockbackForce: attack.isHeavy ? 1.2 : 0.4,
  };
}

/** Sceglie l'attacco migliore per la distanza (data-driven dagli AttackDef). */
function selectAttack(state: GenericEncounterState, distanceM: number): number {
  const attacks = state.def.attacks;
  let best = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < attacks.length; i++) {
    const attack = attacks[i];
    if (attack === undefined) continue;
    // L'attacco il cui range copre il player, preferendo il più corto (preciso)
    const inRange = distanceM <= attack.range + 0.4;
    const score = inRange ? 100 - attack.range : -attack.range;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Angolo normalizzato a [-180, 180). */
function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d >= 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Affinità: < 0 la luce respinge, > 0 la luce attira. Ritorna il delta °/tick. */
function torchInfluenceDegPerTick(state: GenericEncounterState, torchLit: boolean): number {
  if (!torchLit) return 0;
  const affinity = state.def.torchAffinity;
  if (affinity > 0) {
    return 45 / 60;
  }
  if (affinity < 0) {
    return -20 / 60;
  }
  return 0;
}

export function getGenericTelegraphStrength(state: GenericEncounterState): number {
  const r = state.runtime;
  if (r.state !== 'ATTACKING') return 0;
  const attack = state.def.attacks[r.attackIndex];
  if (!attack) return 0;
  const ticksInState = r.stateTicks;
  if (ticksInState < attack.anticipationTicks) {
    return ticksInState / Math.max(1, attack.anticipationTicks);
  }
  if (ticksInState < attack.anticipationTicks + attack.activeTicks) {
    return 1;
  }
  return 0;
}

export function tickGenericEncounter(
  state: GenericEncounterState,
  options: GenericEncounterTickOptions,
): GenericEncounterTickResult {
  const { playerPosition, tick, hasLineOfSight, torchLit } = options;
  const r = state.runtime;

  if (r.state === 'DEAD') {
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  const dx = playerPosition.x - state.position.x;
  const dz = playerPosition.z - state.position.z;
  const distanceM = Math.hypot(dx, dz);
  // Convenzione del resolver (AttackHitResolver.withinArc): yaw 0 = verso -z.
  const angleToPlayerDeg = normalizeDeg(Math.atan2(-dx, -dz) * (180 / Math.PI));

  // Wake: player nel raggio con LOS, o entro hearRadiusM ("sentono").
  // G-04/A-01: uno stimolo di rumore amplifica il raggio di wake per TUTTI
  // gli archetipi (il consumatore AI generalizzato di NOISE_PULSE).
  if (r.state === 'DORMANT') {
    const noise = options.noiseStimulus;
    const noiseDistanceM = noise
      ? Math.hypot(noise.x - state.position.x, noise.z - state.position.z)
      : Number.POSITIVE_INFINITY;
    const canHear = distanceM <= state.def.hearRadiusM;
    const canHearNoise = noise !== null && noise !== undefined
      && noiseDistanceM <= state.def.hearRadiusM * (0.6 + 0.4 * Math.min(1, Math.max(0, noise.intensity)));
    const canSee = distanceM <= GENERIC_WAKE_RADIUS_M && (hasLineOfSight === null || hasLineOfSight());
    if (canSee || canHear || canHearNoise) {
      r.state = 'PURSUING';
      r.stateTicks = 0;
      state.facingDeg = 0;
      return { message: `${state.def.name} si sveglia.`, playerDamageHp: 0, telegraphStrength: 0 };
    }
    r.stateTicks += 1;
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  r.stateTicks += 1;

  // STAGGERED (parata): il nemico è stordito e non agisce finché i tick
  // residui non si esauriscono; poi riprende l'inseguimento.
  if (r.state === 'STAGGERED') {
    r.staggerTicks -= 1;
    if (r.staggerTicks <= 0) {
      r.state = 'PURSUING';
      r.stateTicks = 0;
    }
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  if (r.state === 'ATTACKING') {
    const attack = state.def.attacks[r.attackIndex];
    if (attack) {
      const anticipationTicks = attack.anticipationTicks;
      const activeEnd = anticipationTicks + attack.activeTicks;
      const recoveryEnd = activeEnd + attack.recoveryTicks;

      if (r.stateTicks === anticipationTicks) {
        // Primo tick ACTIVE: risolvi il colpo una sola volta. Prima però la
        // parata: se il player è in finestra, il nemico è davanti e
        // l'attacco è parabile ⇒ danno annullato + stordimento (punish).
        const attackDef = attackDefinitionFromDef(attack.name, attack);
        const parried = options.parryWindowActive === true
          && attackDef.parryable
          && isEnemyInParryArc(options.playerYaw, playerPosition, state.position);
        if (parried) {
          r.state = 'STAGGERED';
          r.stateTicks = 0;
          r.staggerTicks = PARRY_STAGGER_TICKS;
          return { message: null, playerDamageHp: 0, telegraphStrength: 0, parried: true };
        }
        const store = new HurtboxStore();
        store.add(createPlayerHurtbox(playerPosition));
        const registry = new HitRegistry();
        const hit = resolveEnemyAttackHitsPlayer({
          attackerId: state.entityId,
          attack: attackDef,
          attackerPose: {
            x: state.position.x,
            y: state.position.y,
            z: state.position.z,
            yaw: (state.facingDeg * Math.PI) / 180,
          },
          player: playerPosition,
          activeStartTick: state.activeStartTick,
          hitRegistry: registry,
          hasLineOfSight: hasLineOfSight ?? (() => true),
        });
        r.state = 'RECOVERING';
        r.stateTicks = activeEnd;
        if (hit) {
          return { message: null, playerDamageHp: attack.damageHp, telegraphStrength: 1 };
        }
        return { message: null, playerDamageHp: 0, telegraphStrength: 1 };
      }

      if (r.stateTicks >= recoveryEnd) {
        r.state = 'PURSUING';
        r.stateTicks = 0;
      }
      return { message: null, playerDamageHp: 0, telegraphStrength: getGenericTelegraphStrength(state) };
    }
    r.state = 'PURSUING';
    r.stateTicks = 0;
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  if (r.state === 'RECOVERING') {
    const attack = state.def.attacks[r.attackIndex];
    if (attack && r.stateTicks >= attack.anticipationTicks + attack.activeTicks + attack.recoveryTicks) {
      r.state = 'PURSUING';
      r.stateTicks = 0;
    }
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  // PURSUING
  const influence = torchInfluenceDegPerTick(state, torchLit);
  if (influence > 0) {
    // Attratto dalla luce: ruota deciso verso il player
    const delta = normalizeDeg(angleToPlayerDeg - state.facingDeg);
    const step = Math.max(influence, GENERIC_TURN_RATE_DEG_S / 60);
    state.facingDeg = normalizeDeg(state.facingDeg + Math.sign(delta) * Math.min(Math.abs(delta), step));
  } else if (influence < 0) {
    // Respinso: sguardo tremolante, arretra se molto vicino
    state.facingDeg = normalizeDeg(state.facingDeg - influence * 0.5);
  } else {
    const delta = normalizeDeg(angleToPlayerDeg - state.facingDeg);
    const step = GENERIC_TURN_RATE_DEG_S / 60;
    state.facingDeg = normalizeDeg(state.facingDeg + Math.sign(delta) * Math.min(Math.abs(delta), step));
  }

  // Se la luce respinge e il player è molto vicino, arretra
  const retreating = influence < 0 && distanceM < 1.2 && torchLit;
  if (retreating) {
    const backX = -dx / Math.max(0.01, distanceM);
    const backZ = -dz / Math.max(0.01, distanceM);
    state.position.x += backX * state.def.speedMps * 0.35 / 60;
    state.position.z += backZ * state.def.speedMps * 0.35 / 60;
    return { message: `${state.def.name} indietreggia davanti alla luce.`, playerDamageHp: 0, telegraphStrength: 0 };
  }

  // G-04/A-01: il rumore attira lo sguardo se più vicino del player
  // (investigazione: il nemico si volta verso il suono prima di attaccare).
  const noise = options.noiseStimulus;
  if (noise !== null && noise !== undefined && noise.intensity >= 0.4) {
    const noiseDistanceM = Math.hypot(noise.x - state.position.x, noise.z - state.position.z);
    if (noiseDistanceM < distanceM * 0.8) {
      const angleToNoiseDeg = normalizeDeg(
        Math.atan2(-(noise.x - state.position.x), -(noise.z - state.position.z)) * (180 / Math.PI),
      );
      const delta = normalizeDeg(angleToNoiseDeg - state.facingDeg);
      const step = GENERIC_TURN_RATE_DEG_S / 60;
      state.facingDeg = normalizeDeg(state.facingDeg + Math.sign(delta) * Math.min(Math.abs(delta), step));
    }
  }

  // Inseguimento: prima ruota verso il player, poi attacca quando l'angolo
  // residuo è entro metà arco (+ tolleranza) — un ARC manca se non si guarda.
  const attackIndex = selectAttack(state, distanceM);
  const bestAttack = state.def.attacks[attackIndex];
  const inAttackRange = distanceM <= (bestAttack?.range ?? 1.8) + 0.4;
  const facingDelta = Math.abs(normalizeDeg(angleToPlayerDeg - state.facingDeg));
  const arcHalf = (bestAttack?.arcDeg ?? 60) / 2;
  if (inAttackRange && facingDelta <= arcHalf + 12) {
    r.attackIndex = attackIndex;
    r.state = 'ATTACKING';
    r.stateTicks = 0;
    state.activeStartTick = tick;
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  // In range ma non allineato: fermati e chiudi l'angolo (non camminare oltre)
  if (inAttackRange) {
    return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
  }

  // Fuori range: avvicinati ruotando verso il player
  const moveX = -dx / Math.max(0.01, distanceM);
  const moveZ = -dz / Math.max(0.01, distanceM);
  state.position.x += moveX * state.def.speedMps / 60;
  state.position.z += moveZ * state.def.speedMps / 60;

  return { message: null, playerDamageHp: 0, telegraphStrength: 0 };
}
