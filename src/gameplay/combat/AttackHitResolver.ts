/**
 * Scopo: hit detection geometrica deterministica contro hurtbox runtime.
 * Ownership: pura. Consumata dal loop di combattimento del gioco.
 * Invarianti:
 *   - nessun target viene colpito due volte nello stesso swing ACTIVE;
 *   - i bersagli vengono risolti in ordine deterministico per EntityId;
 *   - shape ARC/LINE/SPHERE/CONE restano indipendenti dal renderer.
 * Failure mode: shape sconosciute o dati parziali producono zero hit, senza
 * eccezioni.
 */

import { type EntityId } from '@/ecs/EntityAllocator.js';
import type { AttackDefinition } from '@/gameplay/combat/AttackDefinition.js';
import { HurtboxStore, type HurtboxEntry } from '@/gameplay/combat/HurtboxStore.js';
import { HitRegistry } from '@/gameplay/combat/HitRegistry.js';
import { sortTargetsDeterministically } from '@/gameplay/combat/DamageResolver.js';

export interface AttackPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
}

export interface AttackHitQuery {
  readonly attackerId: EntityId;
  readonly attack: AttackDefinition;
  readonly attackerPose: AttackPose;
  readonly hurtboxes: readonly HurtboxEntry[] | HurtboxStore;
  readonly activeStartTick: number;
  readonly hitRegistry: HitRegistry;
  readonly hasLineOfSight?: (entry: HurtboxEntry) => boolean;
}

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function getForward(yaw: number): { readonly x: number; readonly z: number } {
  return {
    x: -Math.sin(yaw),
    z: -Math.cos(yaw),
  };
}

function getHurtboxes(source: readonly HurtboxEntry[] | HurtboxStore): readonly HurtboxEntry[] {
  return source instanceof HurtboxStore ? source.getAll() : source;
}

function xzDistance(
  attackerPose: AttackPose,
  target: HurtboxEntry,
): number {
  return Math.hypot(target.centerX - attackerPose.x, target.centerZ - attackerPose.z);
}

function withinArc(attack: AttackDefinition, attackerPose: AttackPose, target: HurtboxEntry): boolean {
  const reach = attack.shape.radiusM + target.radiusM;
  if (xzDistance(attackerPose, target) > reach) {
    return false;
  }

  const dx = target.centerX - attackerPose.x;
  const dz = target.centerZ - attackerPose.z;
  const angleToTarget = Math.atan2(-dx, -dz);
  const angleDiff = Math.abs(normalizeAngle(angleToTarget - attackerPose.yaw));
  const halfArcRad = ((attack.shape.arcDeg ?? 90) * Math.PI) / 360;
  return angleDiff <= halfArcRad;
}

function withinSphere(attack: AttackDefinition, attackerPose: AttackPose, target: HurtboxEntry): boolean {
  return xzDistance(attackerPose, target) <= attack.shape.radiusM + target.radiusM;
}

function withinLine(attack: AttackDefinition, attackerPose: AttackPose, target: HurtboxEntry): boolean {
  const lengthM = attack.shape.lengthM ?? attack.shape.radiusM;
  const forward = getForward(attackerPose.yaw);
  const right = { x: -forward.z, z: forward.x };
  const dx = target.centerX - attackerPose.x;
  const dz = target.centerZ - attackerPose.z;
  const along = dx * forward.x + dz * forward.z;
  const lateral = Math.abs(dx * right.x + dz * right.z);

  return (
    along >= -target.radiusM &&
    along <= lengthM + target.radiusM &&
    lateral <= attack.shape.radiusM + target.radiusM
  );
}

function withinCone(attack: AttackDefinition, attackerPose: AttackPose, target: HurtboxEntry): boolean {
  const lengthM = attack.shape.lengthM ?? attack.shape.radiusM;
  const distance = xzDistance(attackerPose, target);
  if (distance > lengthM + target.radiusM) {
    return false;
  }

  const dx = target.centerX - attackerPose.x;
  const dz = target.centerZ - attackerPose.z;
  const angleToTarget = Math.atan2(-dx, -dz);
  const angleDiff = Math.abs(normalizeAngle(angleToTarget - attackerPose.yaw));
  const halfArcRad = ((attack.shape.arcDeg ?? 70) * Math.PI) / 360;
  return angleDiff <= halfArcRad;
}

function matchesShape(attack: AttackDefinition, attackerPose: AttackPose, target: HurtboxEntry): boolean {
  switch (attack.shape.kind) {
    case 'ARC':
      return withinArc(attack, attackerPose, target);
    case 'SPHERE':
      return withinSphere(attack, attackerPose, target);
    case 'LINE':
      return withinLine(attack, attackerPose, target);
    case 'CONE':
      return withinCone(attack, attackerPose, target);
    default:
      return false;
  }
}

export function collectAttackHits(query: AttackHitQuery): readonly EntityId[] {
  const hits: EntityId[] = [];

  for (const target of getHurtboxes(query.hurtboxes)) {
    if (query.hasLineOfSight && !query.hasLineOfSight(target)) {
      continue;
    }
    if (!matchesShape(query.attack, query.attackerPose, target)) {
      continue;
    }

    const accepted = query.hitRegistry.register(
      {
        attackerId: query.attackerId,
        attackId: query.attack.id,
        activeStartTick: query.activeStartTick,
      },
      target.entityId,
    );
    if (accepted) {
      hits.push(target.entityId);
    }
  }

  return sortTargetsDeterministically(hits) as EntityId[];
}
