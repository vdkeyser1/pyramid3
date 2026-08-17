import { ENEMIES } from '@/content/enemies.js';
import type { EntityId } from '@/ecs/EntityAllocator.js';
import {
  SCARAB_CHARGE,
  SCARAB_STATS,
  createScarab,
  startCharge,
  tickScarab,
  type ScarabRuntime,
} from '@/gameplay/enemies/ScarabSystem.js';

export interface ScarabVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface ScarabEncounterState {
  readonly entityId: EntityId;
  readonly name: string;
  readonly maxHp: number;
  hp: number;
  position: ScarabVector3;
  awakened: boolean;
  runtime: ScarabRuntime;
  chargeDirectionX: number;
  chargeDirectionZ: number;
  damageAppliedThisCharge: boolean;
}

export interface ScarabTickResolution {
  readonly playerDamageHp: number;
  readonly message: string | null;
}

export interface ScarabTickOptions {
  readonly playerPosition: ScarabVector3;
  readonly deltaSeconds: number;
  readonly hasLineOfSight: boolean;
  readonly torchAttractor?: ScarabVector3 | null;
  readonly noiseAttractor?: ScarabVector3 | null;
}

export interface ScarabDamageResolution {
  readonly damageHp: number;
  readonly targetHp: number;
  readonly killed: boolean;
}

const SCARAB_DEF = ENEMIES.SCARAB;
const WAKE_RADIUS_M = Math.max(6.5, SCARAB_DEF.viewRadiusM + 1.2);
const APPROACH_SPEED_MPS = Math.max(2.8, SCARAB_DEF.speedMps * 0.48);
const CHARGE_SPEED_MPS = Math.max(7.0, SCARAB_DEF.speedMps * 1.18);
const CHARGE_TRIGGER_RANGE_M = Math.max(2.4, SCARAB_CHARGE.shape.lengthM ?? 2.0);
const CHARGE_HIT_RADIUS_M = 0.82;
const IDLE_DISTANCE_M = 1.15;

function distanceXZ(a: ScarabVector3, b: ScarabVector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function setRuntimeState(scarab: ScarabRuntime, nextState: ScarabRuntime['state']): void {
  if (scarab.state === nextState) {
    return;
  }

  scarab.state = nextState;
  scarab.stateTicks = 0;
}

function moveTowards(
  from: ScarabVector3,
  to: ScarabVector3,
  deltaSeconds: number,
  speedMps: number,
): ScarabVector3 {
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

function selectApproachTarget(
  playerPosition: ScarabVector3,
  torchAttractor: ScarabVector3 | null | undefined,
  noiseAttractor: ScarabVector3 | null | undefined,
  hasLineOfSight: boolean,
): ScarabVector3 {
  if (!hasLineOfSight && noiseAttractor) {
    return noiseAttractor;
  }

  if (!torchAttractor) {
    return playerPosition;
  }

  return distanceXZ(playerPosition, torchAttractor) <= 2.8
    ? playerPosition
    : torchAttractor;
}

export function createScarabEncounterState(
  entityId: EntityId,
  position: ScarabVector3,
): ScarabEncounterState {
  const runtime = createScarab(entityId);
  return {
    entityId,
    name: SCARAB_DEF.name,
    maxHp: SCARAB_STATS.healthHp,
    hp: SCARAB_STATS.healthHp,
    position: { ...position },
    awakened: false,
    runtime,
    chargeDirectionX: 0,
    chargeDirectionZ: 1,
    damageAppliedThisCharge: false,
  };
}

export function isScarabAlive(state: ScarabEncounterState): boolean {
  return state.hp > 0 && state.runtime.state !== 'DEAD';
}

export function getScarabTelegraphStrength(state: ScarabEncounterState): number {
  if (state.runtime.state !== 'CHARGING_TELL') {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, state.runtime.stateTicks / Math.max(1, SCARAB_STATS.chargeTellTicks)),
  );
}

export function applyDamageToScarab(
  state: ScarabEncounterState,
  damageHp: number,
): ScarabDamageResolution {
  if (!isScarabAlive(state) || damageHp <= 0) {
    return {
      damageHp: 0,
      targetHp: state.hp,
      killed: !isScarabAlive(state),
    };
  }

  state.hp = Math.max(0, state.hp - damageHp);
  const killed = state.hp === 0;
  if (killed) {
    state.runtime.state = 'DEAD';
    state.runtime.stateTicks = 0;
    state.awakened = false;
  } else {
    state.awakened = true;
  }

  return {
    damageHp,
    targetHp: state.hp,
    killed,
  };
}

export function tickScarabEncounter(
  state: ScarabEncounterState,
  options: ScarabTickOptions,
): ScarabTickResolution {
  if (!isScarabAlive(state)) {
    return { playerDamageHp: 0, message: null };
  }

  const playerDistanceM = distanceXZ(state.position, options.playerPosition);
  const noiseDistanceM = options.noiseAttractor
    ? distanceXZ(state.position, options.noiseAttractor)
    : Number.POSITIVE_INFINITY;
  if (!state.awakened && options.hasLineOfSight && playerDistanceM <= WAKE_RADIUS_M) {
    state.awakened = true;
    return {
      playerDamageHp: 0,
      message: `${state.name} emerge dalle fessure.`,
    };
  }
  if (!state.awakened && noiseDistanceM <= SCARAB_DEF.hearRadiusM) {
    state.awakened = true;
    return {
      playerDamageHp: 0,
      message: `${state.name} scatta verso il rumore.`,
    };
  }

  if (!state.awakened) {
    tickScarab(state.runtime);
    return { playerDamageHp: 0, message: null };
  }

  if (state.runtime.state === 'CHARGING') {
    state.position = {
      x: state.position.x + state.chargeDirectionX * CHARGE_SPEED_MPS * options.deltaSeconds,
      y: state.position.y,
      z: state.position.z + state.chargeDirectionZ * CHARGE_SPEED_MPS * options.deltaSeconds,
    };

    if (!state.damageAppliedThisCharge && playerDistanceM <= CHARGE_HIT_RADIUS_M) {
      state.damageAppliedThisCharge = true;
      tickScarab(state.runtime);
      return {
        playerDamageHp: SCARAB_CHARGE.damage,
        message: `${state.name} ti investe in carica.`,
      };
    }

    tickScarab(state.runtime);
    return { playerDamageHp: 0, message: null };
  }

  const nextState = tickScarab(state.runtime);

  if (nextState === 'CHARGING') {
    state.damageAppliedThisCharge = false;
    return { playerDamageHp: 0, message: null };
  }

  if (nextState === 'RECOVERING') {
    return { playerDamageHp: 0, message: null };
  }

  const hasChargeWindow =
    options.hasLineOfSight &&
    playerDistanceM <= CHARGE_TRIGGER_RANGE_M &&
    state.runtime.chargeCooldownTicks === 0;
  if (hasChargeWindow && startCharge(state.runtime)) {
    const dx = options.playerPosition.x - state.position.x;
    const dz = options.playerPosition.z - state.position.z;
    const length = Math.hypot(dx, dz);
    if (length > 0.001) {
      state.chargeDirectionX = dx / length;
      state.chargeDirectionZ = dz / length;
    }
    state.damageAppliedThisCharge = false;
    return {
      playerDamageHp: 0,
      message: `${state.name} apre le elitre e prepara la carica.`,
    };
  }

  const approachTarget = selectApproachTarget(
    options.playerPosition,
    options.torchAttractor,
    options.noiseAttractor,
    options.hasLineOfSight,
  );
  const approachDistanceM = distanceXZ(state.position, approachTarget);
  if (approachDistanceM > IDLE_DISTANCE_M) {
    state.position = moveTowards(
      state.position,
      approachTarget,
      options.deltaSeconds,
      APPROACH_SPEED_MPS,
    );
    setRuntimeState(state.runtime, 'APPROACH');
  } else if (nextState !== 'IDLE') {
    setRuntimeState(state.runtime, 'IDLE');
  }

  return { playerDamageHp: 0, message: null };
}
