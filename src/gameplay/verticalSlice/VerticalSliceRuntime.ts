import type { FloorGenerationInput, FloorModel } from '@/procedural/FloorModel.js';
import type { AttackDefinition } from '@/gameplay/combat/AttackDefinition.js';
import { ENEMIES } from '@/content/enemies.js';
import { secondsToTicks } from '@/content/balance.js';
import { buildFloorSceneLayout, type FloorSceneLayout } from '@/world/FloorSceneLayout.js';

export interface SliceVector3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SlicePlayerPose extends SliceVector3 {
  readonly yaw: number;
}

export interface SliceTargetState {
  readonly name: string;
  readonly maxHp: number;
  hp: number;
  position: SliceVector3;
  awakened: boolean;
  wakeTicksRemaining: number;
  attackCooldownTicks: number;
  attackWindupTicks: number;
}

export interface VerticalSliceState {
  readonly floor: FloorModel;
  readonly sceneLayout: FloorSceneLayout;
  readonly objectiveLabel: string;
  readonly floorSummary: string;
  readonly target: SliceTargetState;
  readonly exitPosition: SliceVector3;
  exitUnlocked: boolean;
  completed: boolean;
  failed: boolean;
}

export type AttackResolution =
  | { readonly kind: 'NO_TARGET' }
  | { readonly kind: 'MISS_RANGE'; readonly distanceM: number }
  | { readonly kind: 'MISS_OBSTRUCTED' }
  | { readonly kind: 'MISS_ARC'; readonly angleDeg: number }
  | { readonly kind: 'HIT'; readonly damageHp: number; readonly targetHp: number; readonly killed: boolean };

export interface SliceDamageResolution {
  readonly damageHp: number;
  readonly targetHp: number;
  readonly killed: boolean;
}

export type ExitResolution = 'TOO_FAR' | 'LOCKED' | 'COMPLETE' | 'ALREADY_COMPLETE' | 'STAIR';

export interface SliceTickResolution {
  readonly playerDamageHp: number;
  readonly message: string | null;
}

export const VERTICAL_SLICE_GENERATION_INPUT: FloorGenerationInput = {
  seed: 0x1a2b3c4d,
  generationVersion: 1,
  isTutorial: false,
  floorIndex: 1,
};

const TARGET_COLLISION_RADIUS_M = 0.95;
const PLAYER_HIT_PROXY_RADIUS_M = 0.45;
const EXIT_RADIUS_M = 2.4;
const TARGET_DEF = ENEMIES.MUMMY;

function getTargetPrimaryAttack() {
  const attack = TARGET_DEF.attacks[0];
  if (!attack) {
    throw new Error('Vertical slice target attack missing');
  }
  return attack;
}

const TARGET_PRIMARY_ATTACK = getTargetPrimaryAttack();
const TARGET_WAKE_RADIUS_M = Math.max(7.5, TARGET_DEF.viewRadiusM + 3.0);
const TARGET_ATTACK_RANGE_M = Math.max(1.85, TARGET_PRIMARY_ATTACK.range - 0.35);
const TARGET_MOVE_SPEED_MPS = Math.max(1.9, TARGET_DEF.speedMps * 1.2);
const TARGET_WAKE_TICKS = Math.max(
  secondsToTicks(0.7),
  Math.round(TARGET_PRIMARY_ATTACK.anticipationTicks * 0.7),
);
const TARGET_ATTACK_WINDUP_TICKS = Math.max(
  secondsToTicks(0.55),
  TARGET_PRIMARY_ATTACK.anticipationTicks,
);
const TARGET_ATTACK_COOLDOWN_TICKS = Math.max(
  secondsToTicks(1.0),
  TARGET_PRIMARY_ATTACK.recoveryTicks,
);
const ZONE_PADDING_M = 0.3;

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function distanceXZ(a: SliceVector3, b: SliceVector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

interface ZoneRef {
  readonly id: string;
  readonly center: SliceVector3;
}

function roomZoneId(roomId: FloorSceneLayout['rooms'][number]['roomId']): string {
  return `room:${String(roomId)}`;
}

function corridorZoneId(index: number): string {
  return `corridor:${index}`;
}

function pointInBounds(
  point: SliceVector3,
  bounds: FloorSceneLayout['rooms'][number]['bounds'],
  paddingM = 0,
): boolean {
  return (
    point.x >= bounds.minX - paddingM &&
    point.x <= bounds.maxX + paddingM &&
    point.z >= bounds.minZ - paddingM &&
    point.z <= bounds.maxZ + paddingM
  );
}

function corridorCenter(corridor: FloorSceneLayout['corridors'][number]): SliceVector3 {
  return {
    x: (corridor.bounds.minX + corridor.bounds.maxX) / 2,
    y: 1.05,
    z: (corridor.bounds.minZ + corridor.bounds.maxZ) / 2,
  };
}

function findZoneById(layout: FloorSceneLayout, zoneId: string): ZoneRef | null {
  if (zoneId.startsWith('room:')) {
    const rawId = Number(zoneId.slice('room:'.length));
    const room = layout.rooms.find((candidate) => Number(candidate.roomId) === rawId);
    if (!room) return null;
    return {
      id: zoneId,
      center: { x: room.center.x, y: 1.05, z: room.center.z },
    };
  }

  if (!zoneId.startsWith('corridor:')) {
    return null;
  }

  const corridorIndex = Number(zoneId.slice('corridor:'.length));
  const corridor = layout.corridors[corridorIndex];
  if (!corridor) return null;
  return {
    id: zoneId,
    center: corridorCenter(corridor),
  };
}

function nearestZone(layout: FloorSceneLayout, position: SliceVector3): ZoneRef | null {
  let bestZone: ZoneRef | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const room of layout.rooms) {
    const center = { x: room.center.x, y: 1.05, z: room.center.z };
    const distance = distanceXZ(position, center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestZone = { id: roomZoneId(room.roomId), center };
    }
  }

  for (let i = 0; i < layout.corridors.length; i++) {
    const corridor = layout.corridors[i];
    if (!corridor) continue;
    const center = corridorCenter(corridor);
    const distance = distanceXZ(position, center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestZone = { id: corridorZoneId(i), center };
    }
  }

  return bestZone;
}

function findContainingZone(layout: FloorSceneLayout, position: SliceVector3): ZoneRef | null {
  for (const room of layout.rooms) {
    if (pointInBounds(position, room.bounds, ZONE_PADDING_M)) {
      return {
        id: roomZoneId(room.roomId),
        center: { x: room.center.x, y: 1.05, z: room.center.z },
      };
    }
  }

  for (let i = 0; i < layout.corridors.length; i++) {
    const corridor = layout.corridors[i];
    if (!corridor) continue;
    if (pointInBounds(position, corridor.bounds, ZONE_PADDING_M)) {
      return {
        id: corridorZoneId(i),
        center: corridorCenter(corridor),
      };
    }
  }

  return nearestZone(layout, position);
}

function getZoneNeighbors(layout: FloorSceneLayout, zoneId: string): readonly string[] {
  if (zoneId.startsWith('room:')) {
    const rawId = Number(zoneId.slice('room:'.length));
    return layout.corridors.flatMap((corridor, index) =>
      Number(corridor.fromRoomId) === rawId || Number(corridor.toRoomId) === rawId
        ? [corridorZoneId(index)]
        : [],
    );
  }

  if (!zoneId.startsWith('corridor:')) {
    return [];
  }

  const corridorIndex = Number(zoneId.slice('corridor:'.length));
  const corridor = layout.corridors[corridorIndex];
  if (!corridor) {
    return [];
  }

  return [
    roomZoneId(corridor.fromRoomId),
    roomZoneId(corridor.toRoomId),
  ];
}

function findZonePath(
  layout: FloorSceneLayout,
  fromPosition: SliceVector3,
  toPosition: SliceVector3,
): readonly string[] | null {
  const startZone = findContainingZone(layout, fromPosition);
  const endZone = findContainingZone(layout, toPosition);
  if (!startZone || !endZone) {
    return null;
  }
  if (startZone.id === endZone.id) {
    return [startZone.id];
  }

  const visited = new Set<string>([startZone.id]);
  const parent = new Map<string, string>();
  const queue: string[] = [startZone.id];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const neighbor of getZoneNeighbors(layout, current)) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);
      if (neighbor === endZone.id) {
        const path = [endZone.id];
        let cursor = endZone.id;
        while (cursor !== startZone.id) {
          const previous = parent.get(cursor);
          if (!previous) {
            return null;
          }
          path.push(previous);
          cursor = previous;
        }
        return path.reverse();
      }
      queue.push(neighbor);
    }
  }

  return null;
}

function hasDirectEngageRoute(
  layout: FloorSceneLayout,
  fromPosition: SliceVector3,
  toPosition: SliceVector3,
): boolean {
  const path = findZonePath(layout, fromPosition, toPosition);
  return path !== null && path.length <= 2;
}

function resolvePursuitPoint(
  layout: FloorSceneLayout,
  fromPosition: SliceVector3,
  playerPosition: SliceVector3,
): SliceVector3 {
  const path = findZonePath(layout, fromPosition, playerPosition);
  if (!path || path.length <= 1) {
    return playerPosition;
  }

  const nextZone = findZoneById(layout, path[1] ?? '');
  return nextZone?.center ?? playerPosition;
}

function createObjectiveLabel(targetName: string): string {
  return `Elimina ${targetName} e raggiungi la porta sigillata`;
}

function createFloorSummary(floor: FloorModel): string {
  return `${floor.floorId} · stanze ${floor.rooms.length} · uscita ${String(floor.exitRoomId)}`;
}

export function createVerticalSliceState(floor: FloorModel): VerticalSliceState {
  const targetMaxHp = Math.max(36, Math.min(48, TARGET_DEF.baseHp));
  const sceneLayout = buildFloorSceneLayout(floor);

  return {
    floor,
    sceneLayout,
    objectiveLabel: createObjectiveLabel(TARGET_DEF.name),
    floorSummary: createFloorSummary(floor),
    target: {
      name: TARGET_DEF.name,
      maxHp: targetMaxHp,
      hp: targetMaxHp,
      position: { ...sceneLayout.targetPosition },
      awakened: false,
      wakeTicksRemaining: 0,
      attackCooldownTicks: 0,
      attackWindupTicks: 0,
    },
    exitPosition: sceneLayout.exitPosition,
    exitUnlocked: false,
    completed: false,
    failed: false,
  };
}

export function getObjectiveText(state: VerticalSliceState): string {
  if (state.completed) {
    return 'Runa recuperata. Uscita confermata.';
  }
  if (state.failed) {
    return 'Sei caduto nella cripta. Ricarica per riprovare.';
  }
  if (state.exitUnlocked) {
    return 'Varco aperto. Raggiungi la porta e premi E.';
  }
  return state.target.awakened ? 'Respingi il guardiano e apri il sigillo.' : state.objectiveLabel;
}

export function getTargetHudText(state: VerticalSliceState): string {
  if (state.target.hp <= 0) {
    return `${state.target.name} neutralizzata`;
  }
  const phase =
    state.target.wakeTicksRemaining > 0 ? 'in risveglio' :
    state.target.attackWindupTicks > 0 ? 'in attacco' :
    state.target.attackCooldownTicks > 0 ? 'in recupero' :
    state.target.awakened ? 'in caccia' :
    'quiescente';
  return `${state.target.name}: ${state.target.hp}/${state.target.maxHp} HP · ${phase}`;
}

export function getTargetTelegraphStrength(state: VerticalSliceState): number {
  if (state.target.attackWindupTicks <= 0) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(1, 1 - state.target.attackWindupTicks / Math.max(1, TARGET_ATTACK_WINDUP_TICKS)),
  );
}

export function isTargetAlive(state: VerticalSliceState): boolean {
  return state.target.hp > 0;
}

export function applyDamageToSliceTarget(
  state: VerticalSliceState,
  damageHp: number,
): SliceDamageResolution {
  if (!isTargetAlive(state) || damageHp <= 0) {
    return {
      damageHp: 0,
      targetHp: state.target.hp,
      killed: !isTargetAlive(state),
    };
  }

  state.target.hp = Math.max(0, state.target.hp - damageHp);
  const killed = state.target.hp === 0;
  if (killed) {
    state.exitUnlocked = true;
    state.target.awakened = false;
    state.target.wakeTicksRemaining = 0;
    state.target.attackCooldownTicks = 0;
    state.target.attackWindupTicks = 0;
  } else if (!state.target.awakened) {
    state.target.awakened = true;
    state.target.wakeTicksRemaining = Math.max(state.target.wakeTicksRemaining, secondsToTicks(0.35));
  }

  return {
    damageHp,
    targetHp: state.target.hp,
    killed,
  };
}

export function applyAttackToSlice(
  state: VerticalSliceState,
  attack: AttackDefinition,
  playerPose: SlicePlayerPose,
): AttackResolution {
  if (!isTargetAlive(state)) {
    return { kind: 'NO_TARGET' };
  }

  const distanceM = distanceXZ(playerPose, state.target.position);
  const maxReach = attack.shape.radiusM + TARGET_COLLISION_RADIUS_M + PLAYER_HIT_PROXY_RADIUS_M;
  if (distanceM > maxReach) {
    return { kind: 'MISS_RANGE', distanceM };
  }

  if (!hasDirectEngageRoute(state.sceneLayout, state.target.position, playerPose)) {
    return { kind: 'MISS_OBSTRUCTED' };
  }

  const dx = state.target.position.x - playerPose.x;
  const dz = state.target.position.z - playerPose.z;
  const angleToTarget = Math.atan2(-dx, -dz);
  const angleDiff = Math.abs(normalizeAngle(angleToTarget - playerPose.yaw));
  const halfArcRad = ((attack.shape.arcDeg ?? 90) * Math.PI) / 360;

  if (angleDiff > halfArcRad) {
    return {
      kind: 'MISS_ARC',
      angleDeg: Math.round((angleDiff * 180) / Math.PI),
    };
  }

  const damageResolution = applyDamageToSliceTarget(state, attack.damage);

  return {
    kind: 'HIT',
    damageHp: damageResolution.damageHp,
    targetHp: damageResolution.targetHp,
    killed: damageResolution.killed,
  };
}

export function tryCompleteSlice(state: VerticalSliceState, playerPose: SliceVector3): ExitResolution {
  if (state.completed) return 'ALREADY_COMPLETE';
  if (distanceXZ(playerPose, state.exitPosition) > EXIT_RADIUS_M) return 'TOO_FAR';
  if (!state.exitUnlocked) return 'LOCKED';
  state.completed = true;
  // G-10: i piani non-finali escono con una scala verso il basso
  if (state.floor.exitIsStair) {
    return 'STAIR';
  }
  return 'COMPLETE';
}

export function tickVerticalSlice(
  state: VerticalSliceState,
  playerPose: SliceVector3,
  deltaSeconds: number,
): SliceTickResolution {
  if (state.completed || state.failed || !isTargetAlive(state)) {
    return { playerDamageHp: 0, message: null };
  }

  const target = state.target;
  const distanceM = distanceXZ(playerPose, target.position);
  const canDirectlyEngage = hasDirectEngageRoute(state.sceneLayout, target.position, playerPose);
  if (!target.awakened && distanceM <= TARGET_WAKE_RADIUS_M && canDirectlyEngage) {
    target.awakened = true;
    target.wakeTicksRemaining = TARGET_WAKE_TICKS;
    return { playerDamageHp: 0, message: `${target.name} si desta dalla tomba.` };
  }

  if (!target.awakened) {
    return { playerDamageHp: 0, message: null };
  }

  if (target.wakeTicksRemaining > 0) {
    target.wakeTicksRemaining--;
    return { playerDamageHp: 0, message: null };
  }

  if (target.attackCooldownTicks > 0) target.attackCooldownTicks--;
  if (target.attackWindupTicks > 0) {
    target.attackWindupTicks--;
    if (
      target.attackWindupTicks === 0 &&
      canDirectlyEngage &&
      distanceM <= TARGET_ATTACK_RANGE_M + PLAYER_HIT_PROXY_RADIUS_M
    ) {
      target.attackCooldownTicks = TARGET_ATTACK_COOLDOWN_TICKS;
      return {
        playerDamageHp: TARGET_PRIMARY_ATTACK.damageHp,
        message: `${target.name} ti colpisce con ${TARGET_PRIMARY_ATTACK.name.toLowerCase()}.`,
      };
    }
    if (target.attackWindupTicks === 0) {
      target.attackCooldownTicks = TARGET_ATTACK_COOLDOWN_TICKS;
      return { playerDamageHp: 0, message: `${target.name} fende il vuoto. Hai evitato il colpo.` };
    }
    return { playerDamageHp: 0, message: null };
  }

  if (distanceM > TARGET_ATTACK_RANGE_M || !canDirectlyEngage) {
    const step = TARGET_MOVE_SPEED_MPS * deltaSeconds;
    const pursuitPoint = resolvePursuitPoint(state.sceneLayout, target.position, playerPose);
    const dx = pursuitPoint.x - target.position.x;
    const dz = pursuitPoint.z - target.position.z;
    const length = Math.hypot(dx, dz);
    if (length > 0.001) {
      const move = Math.min(step, Math.max(0, length - TARGET_ATTACK_RANGE_M * 0.9));
      target.position = {
        x: target.position.x + (dx / length) * move,
        y: target.position.y,
        z: target.position.z + (dz / length) * move,
      };
    }
    return { playerDamageHp: 0, message: null };
  }

  if (target.attackCooldownTicks === 0) {
    target.attackWindupTicks = TARGET_ATTACK_WINDUP_TICKS;
    return {
      playerDamageHp: 0,
      message: `${target.name} prepara ${TARGET_PRIMARY_ATTACK.name.toLowerCase()}.`,
    };
  }

  return { playerDamageHp: 0, message: null };
}

export function markSliceFailed(state: VerticalSliceState): void {
  state.failed = true;
}
