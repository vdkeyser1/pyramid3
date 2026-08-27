/**
 * Scopo: sistema di percezione nemica (vista, udito, Ka) a 10 Hz.
 * Ownership: Simulation. Legge i transform store del world ECS.
 */

import type { EnemyDef } from '@/content/enemies.js';

export interface PerceptionResult {
  readonly canSee: boolean;
  readonly canHear: boolean;
  readonly canSenseKa: boolean;
  readonly distance: number;
  readonly noiseLevel: number;
}

/**
 * Verifica se un nemico percepisce il giocatore.
 *
 * @param enemyDef - definizione del nemico
 * @param enemyX, enemyY, enemyZ - posizione nemico
 * @param enemyYaw - rotazione Y del nemico in radianti
 * @param playerX, playerY, playerZ - posizione giocatore
 * @param playerNoise - livello di rumore del giocatore (0-10)
 * @param torchState - stato torcia ('OFF'|'LOW'|'HIGH'|'PLACED')
 */
export function checkPerception(
  enemyDef: EnemyDef,
  enemyX: number,
  enemyY: number,
  enemyZ: number,
  enemyYaw: number,
  playerX: number,
  playerY: number,
  playerZ: number,
  playerNoise: number,
  torchState: string,
): PerceptionResult {
  const dx = playerX - enemyX;
  const dy = playerY - enemyY;
  const dz = playerZ - enemyZ;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Vista: cono frontale
  let canSee = false;
  if (distance <= enemyDef.viewRadiusM) {
    const angleToPlayer = Math.atan2(dx, dz);
    let angleDiff = angleToPlayer - enemyYaw;
    // Normalizza a [-PI, PI]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    const halfView = (enemyDef.viewAngleDeg * Math.PI) / 360;
    if (Math.abs(angleDiff) <= halfView) {
      // La torcia influenza la percezione visiva
      const lightFactor = torchState === 'HIGH' || torchState === 'PLACED' ? 1.0
        : torchState === 'LOW' ? 0.6
        : 0.3;
      canSee = distance <= enemyDef.viewRadiusM * lightFactor;
    }
  }

  // Udito: sfera, attenuato da distanza
  const hearRadius = enemyDef.hearRadiusM * (1 + playerNoise * 0.5);
  const canHear = distance <= hearRadius;

  // Ka: solo nemici corrotti, ignora muri
  const canSenseKa = enemyDef.isCorrupted && distance <= 4.0;

  return { canSee, canHear, canSenseKa, distance, noiseLevel: playerNoise };
}
