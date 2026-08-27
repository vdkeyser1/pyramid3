/**
 * Scopo: steering locale per sciami (scarabei) oltre una soglia (§30.1, §44.4).
 * Ownership: simulazione AI.
 * Invarianti:
 *   - flow field solo per sciami oltre soglia di numerosità;
 *   - massimo due cariche simultanee (§11.4);
 *   - attrazione verso torcia posata (torchAffinity +0.7).
 */

import type { Vec3 } from '@/math/Vec3.js';
import { sub, normalize, lengthSq } from '@/math/Vec3.js';

export interface SwarmAgent {
  readonly entityId: number;
  position: Vec3;
  velocity: Vec3;
  isCharging: boolean;
  chargeCooldownTicks: number;
}

export interface SwarmConfig {
  readonly separationRadius: number;
  readonly separationWeight: number;
  readonly cohesionWeight: number;
  readonly alignmentWeight: number;
  readonly targetWeight: number;
  readonly maxSpeed: number;
  readonly maxSimultaneousCharges: number;
}

export const DEFAULT_SCARAB_SWARM_CONFIG: SwarmConfig = {
  separationRadius: 0.6,
  separationWeight: 1.5,
  cohesionWeight: 0.8,
  alignmentWeight: 0.5,
  targetWeight: 2.0,
  maxSpeed: 4.0,
  maxSimultaneousCharges: 2,
};

/**
 * Calcola la steering force per un agente nello sciame.
 */
export function computeSwarmSteering(
  agent: SwarmAgent,
  swarm: readonly SwarmAgent[],
  targetPos: Vec3,
  config: SwarmConfig,
): Vec3 {
  let separationX = 0, separationZ = 0;
  let cohesionX = 0, cohesionZ = 0;
  let alignmentX = 0, alignmentZ = 0;
  let neighborCount = 0;

  for (const other of swarm) {
    if (other.entityId === agent.entityId) continue;
    const diff = sub(agent.position, other.position);
    const distSq = lengthSq(diff);

    if (distSq < config.separationRadius * config.separationRadius && distSq > 0.001) {
      const norm = normalize(diff);
      const weight = 1 / Math.sqrt(distSq);
      separationX += norm.x * weight;
      separationZ += norm.z * weight;
    }

    cohesionX += other.position.x;
    cohesionZ += other.position.z;
    alignmentX += other.velocity.x;
    alignmentZ += other.velocity.z;
    neighborCount++;
  }

  let steerX = 0, steerZ = 0;

  // Separazione
  steerX += separationX * config.separationWeight;
  steerZ += separationZ * config.separationWeight;

  // Coesione
  if (neighborCount > 0) {
    const centerX = cohesionX / neighborCount - agent.position.x;
    const centerZ = cohesionZ / neighborCount - agent.position.z;
    steerX += centerX * config.cohesionWeight;
    steerZ += centerZ * config.cohesionWeight;

    // Allineamento
    steerX += (alignmentX / neighborCount) * config.alignmentWeight;
    steerZ += (alignmentZ / neighborCount) * config.alignmentWeight;
  }

  // Target (giocatore o torcia posata)
  const toTarget = sub(targetPos, agent.position);
  const toTargetNorm = normalize(toTarget);
  steerX += toTargetNorm.x * config.targetWeight;
  steerZ += toTargetNorm.z * config.targetWeight;

  return normalize({ x: steerX, y: 0, z: steerZ });
}

/**
 * Conta le cariche attive nello sciame.
 */
export function countActiveCharges(swarm: readonly SwarmAgent[]): number {
  return swarm.filter((a) => a.isCharging).length;
}

/**
 * Verifica se un nuovo agente può iniziare una carica.
 */
export function canStartCharge(
  swarm: readonly SwarmAgent[],
  config: SwarmConfig,
): boolean {
  return countActiveCharges(swarm) < config.maxSimultaneousCharges;
}
