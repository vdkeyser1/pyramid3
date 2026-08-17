/**
 * Scopo: encounter runtime della Mummia Dormiente materializzabile dal Threat
 *        Director (G-03 residuo). A differenza della guardiana fissa del VS,
 *        questo runtime è istanziabile in qualsiasi stanza: risveglio, pursuit
 *        lenta (rotazione 60°/s, velocità bassa), fendente ARC 120° con hit
 *        detection unificata via EnemyAttackResolver, recoil alla luce.
 * Ownership: gameplay/enemies. Consumato da GameApplication.
 * Invarianti:
 *   - nessun danno senza telegrafo (wake 2.5s + anticipation 1.0s);
 *   - hit-once per fendente (HitRegistry sullo swing ACTIVE);
 *   - deterministica: stessi input ⇒ stesso esito.
 * Failure mode: LOS assente ⇒ nessun attacco (ma pursuit continua).
 */

import { ENEMIES } from '@/content/enemies.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import {
  MUMMY_SLASH,
  MUMMY_STATS,
  applyLightRecoil,
  createMummy,
  rotateMummyToward,
  tickMummy,
  wakeMummy,
  type MummyRuntime,
  type MummyState,
} from '@/gameplay/enemies/MummySystem.js';
import { resolveEnemyAttackHitsPlayer } from '@/gameplay/combat/EnemyAttackResolver.js';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import { isEnemyInParryArc, PARRY_STAGGER_TICKS } from '@/gameplay/combat/ParryResolver.js';

export interface MummyVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface MummyEncounterState {
  readonly entityId: EntityId;
  readonly name: string;
  readonly maxHp: number;
  hp: number;
  position: MummyVector3;
  runtime: MummyRuntime;
  /** Tick di inizio dello swing ACTIVE corrente (per hit-once). */
  activeStartTick: number;
  /** True se la LOS è disponibile (muri tra nemico e player). */
  hasLineOfSight: boolean;
  /** Tick residui di stordimento (parata): >0 ⇒ la mummia non agisce. */
  staggerTicks: number;
}

export interface MummyTickOptions {
  readonly playerPosition: MummyVector3;
  readonly playerYaw: number;
  readonly deltaSeconds: number;
  readonly hasLineOfSight: boolean;
  /** True se la torcia è accesa vicino (trigger recoil). */
  readonly torchLitNearby: boolean;
  readonly tick: number;
  /** True se la finestra di parata del player è attiva (Parry appena premuto). */
  readonly parryWindowActive?: boolean;
}

export interface MummyTickResolution {
  readonly playerDamageHp: number;
  readonly message: string | null;
  readonly state: MummyState;
  /** True se il fendente è stato parato (danno annullato, mummia stordita). */
  readonly parried?: boolean;
}

const MUMMY_DEF = ENEMIES.MUMMY;
const WAKE_RADIUS_M = Math.max(5.0, MUMMY_DEF.viewRadiusM + 0.8);
const PURSUE_SPEED_MPS = Math.max(1.5, MUMMY_DEF.speedMps * 0.75);
const SLASH_TRIGGER_RANGE_M = MUMMY_SLASH.shape.radiusM + 0.3;
const RECOIL_LIGHT_RADIUS_M = 4.0;
const RECOIL_BACKSTEP_M = 0.9;

function distanceXZ(a: MummyVector3, b: MummyVector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function angleToDeg(from: MummyVector3, to: MummyVector3): number {
  return (Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI;
}

function moveTowards(
  from: MummyVector3,
  to: MummyVector3,
  deltaSeconds: number,
  speedMps: number,
): MummyVector3 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  if (distance <= 0.001) {
    return from;
  }
  const move = Math.min(distance, speedMps * deltaSeconds);
  return {
    x: from.x + (dx / distance) * move,
    y: from.y,
    z: from.z + (dz / distance) * move,
  };
}

export function createMummyEncounterState(entityId: EntityId, position: MummyVector3): MummyEncounterState {
  return {
    entityId,
    name: MUMMY_DEF.name,
    maxHp: MUMMY_STATS.healthHp,
    hp: MUMMY_STATS.healthHp,
    position: { ...position },
    runtime: createMummy(entityId),
    activeStartTick: 0,
    hasLineOfSight: false,
    staggerTicks: 0,
  };
}

export function isMummyAlive(state: MummyEncounterState): boolean {
  return state.hp > 0 && state.runtime.state !== 'DEAD';
}

/**
 * Telegrafo visivo: 0 = nessuno, 1 = fendente imminente (durante
 * anticipation). Usato dal renderer per il segnale punish/telegraph.
 */
export function getMummyTelegraphStrength(state: MummyEncounterState): number {
  if (state.runtime.state !== 'ATTACKING') {
    return 0;
  }
  const anticipationTicks = MUMMY_SLASH.anticipationTicks;
  const elapsed = state.runtime.stateTicks;
  if (elapsed >= anticipationTicks) {
    return 0; // ACTIVE: troppo tardi per il segnale
  }
  return Math.max(0, 1 - elapsed / anticipationTicks);
}

export function tickMummyEncounter(
  state: MummyEncounterState,
  options: MummyTickOptions,
  registry = new HitRegistry(),
): MummyTickResolution {
  state.hasLineOfSight = options.hasLineOfSight;
  const playerDistance = distanceXZ(state.position, options.playerPosition);

  // STAGGERED (parata): la mummia è stordita e non agisce finché i tick
  // residui non si esauriscono.
  if (state.staggerTicks > 0) {
    state.staggerTicks--;
    return { playerDamageHp: 0, message: null, state: state.runtime.state };
  }

  // Risveglio: il player entra nel raggio CON LOS (il sarcofago sigilla il suono).
  if (state.runtime.state === 'SLEEPING' && playerDistance <= WAKE_RADIUS_M && options.hasLineOfSight) {
    if (wakeMummy(state.runtime)) {
      return {
        playerDamageHp: 0,
        message: `${state.name} si solleva dal sarcofago.`,
        state: state.runtime.state,
      };
    }
  }

  // ATTACKING: anticipation → ACTIVE (danno) → recovery. stateTicks avanza
  // ad ogni tick tramite tickMummy: le soglie si leggono PRIMA dell'incremento.
  if (state.runtime.state === 'ATTACKING') {
    const ticksInState = state.runtime.stateTicks;
    const anticipationTicks = MUMMY_SLASH.anticipationTicks;
    const activeTicks = MUMMY_SLASH.activeTicks;

    if (ticksInState < anticipationTicks) {
      // Ancora in anticipation (telegrafo): avanza e resta in attesa.
      tickMummy(state.runtime);
      return { playerDamageHp: 0, message: null, state: state.runtime.state };
    }

    if (ticksInState === anticipationTicks) {
      // Inizio fase ACTIVE: risolvi il colpo una sola volta. Prima però la
      // parata: finestra attiva + attacco parabile + mummia davanti ⇒
      // danno annullato + stordimento (punish window).
      const parried = options.parryWindowActive === true
        && MUMMY_SLASH.parryable
        && isEnemyInParryArc(options.playerYaw, options.playerPosition, state.position);
      if (parried) {
        state.staggerTicks = PARRY_STAGGER_TICKS;
        state.runtime.state = 'RECOVERING';
        state.runtime.stateTicks = 0;
        return {
          playerDamageHp: 0,
          message: `${state.name} vacilla, il fendente è parato.`,
          state: state.runtime.state,
          parried: true,
        };
      }
      state.activeStartTick = options.tick;
      const los = options.hasLineOfSight ? () => true : undefined;
      const hit = resolveEnemyAttackHitsPlayer({
        attackerId: state.entityId,
        attack: MUMMY_SLASH,
        attackerPose: {
          x: state.position.x,
          y: state.position.y,
          z: state.position.z,
          yaw: (state.runtime.currentRotationDeg * Math.PI) / 180,
        },
        player: {
          x: options.playerPosition.x,
          y: options.playerPosition.y,
          z: options.playerPosition.z,
        },
        activeStartTick: options.tick,
        hitRegistry: registry,
        ...(los ? { hasLineOfSight: los } : {}),
      });
      tickMummy(state.runtime);
      if (hit) {
        return {
          playerDamageHp: MUMMY_SLASH.damage,
          message: `${state.name} ti colpisce con un fendente.`,
          state: state.runtime.state,
        };
      }
      return { playerDamageHp: 0, message: null, state: state.runtime.state };
    }

    if (ticksInState >= anticipationTicks + activeTicks) {
      tickMummy(state.runtime); // → RECOVERING
      return { playerDamageHp: 0, message: null, state: state.runtime.state };
    }

    // Metà ACTIVE: avanza senza risolvere di nuovo (hit-once già registrato).
    tickMummy(state.runtime);
    return { playerDamageHp: 0, message: null, state: state.runtime.state };
  }

  // RECOVERING: nessuna azione, il tick del sistema avanza.
  if (state.runtime.state === 'RECOVERING') {
    tickMummy(state.runtime);
    return { playerDamageHp: 0, message: null, state: state.runtime.state };
  }

  // IDLE/PURSUING: decide la prossima azione.
  const previousState = state.runtime.state;
  tickMummy(state.runtime);

  if (state.runtime.state === 'DEAD' || previousState === 'DEAD') {
    return { playerDamageHp: 0, message: null, state: state.runtime.state };
  }

  // Recoil alla luce (torchAffinity −0.6): arretra se la torcia è vicina.
  if (options.torchLitNearby && playerDistance <= RECOIL_LIGHT_RADIUS_M) {
    if (applyLightRecoil(state.runtime)) {
      const away = moveTowards(state.position, options.playerPosition, -1, RECOIL_BACKSTEP_M * 2);
      state.position = { ...away };
      return {
        playerDamageHp: 0,
        message: `${state.name} arretra dalla luce.`,
        state: state.runtime.state,
      };
    }
  }

  if (state.runtime.state !== 'PURSUING' && state.runtime.state !== 'IDLE') {
    return { playerDamageHp: 0, message: null, state: state.runtime.state };
  }

  // Pursuit lenta con rotazione limitata.
  if (playerDistance > SLASH_TRIGGER_RANGE_M) {
    rotateMummyToward(state.runtime, angleToDeg(state.position, options.playerPosition));
    state.position = moveTowards(state.position, options.playerPosition, options.deltaSeconds, PURSUE_SPEED_MPS);
    if (state.runtime.state === 'IDLE') {
      state.runtime.state = 'PURSUING';
      state.runtime.stateTicks = 0;
    }
    return { playerDamageHp: 0, message: null, state: state.runtime.state };
  }

  // In range: inizia il fendente (telegrafo 1.0s).
  rotateMummyToward(state.runtime, angleToDeg(state.position, options.playerPosition));
  state.runtime.state = 'ATTACKING';
  state.runtime.stateTicks = 0;
  return {
    playerDamageHp: 0,
    message: null,
    state: state.runtime.state,
  };
}
