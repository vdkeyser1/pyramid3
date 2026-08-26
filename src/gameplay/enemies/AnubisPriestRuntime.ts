/**
 * AnubisPriestRuntime.ts
 * Logica di comportamento e stati AI per il Sommo Sacerdote di Anubi.
 * Meccaniche:
 * - Teletrasporto dell'Ombra (quando il giocatore si avvicina troppo in mischia);
 * - Dardo della Duat (proiettile magico a lungo raggio);
 * - Evocazione delle Ombre (crea 2 servitori mummificati o scarabei di guardia);
 * - Barriera del Ka (immunità temporanea ai colpi frontali se non spezzata dal retro).
 */

export type PriestState = 'IDLE' | 'CHANTER' | 'CAST_DUAT_BOLT' | 'TELEPORT' | 'SUMMONING' | 'STUNNED' | 'DEAD';

export interface PriestConfig {
  readonly maxHp: number;
  readonly castIntervalSec: number;
  readonly teleportCooldownSec: number;
  readonly preferredDistanceM: number;
}

export interface PriestInstance {
  hp: number;
  readonly maxHp: number;
  position: { x: number; y: number; z: number };
  state: PriestState;
  castCooldownSec: number;
  teleportCooldownSec: number;
  shieldActive: boolean;
}

export const DEFAULT_PRIEST_CONFIG: PriestConfig = {
  maxHp: 220,
  castIntervalSec: 3.5,
  teleportCooldownSec: 6.0,
  preferredDistanceM: 5.5,
};

export function createPriestInstance(
  x: number,
  y: number,
  z: number,
  config: PriestConfig = DEFAULT_PRIEST_CONFIG,
): PriestInstance {
  return {
    hp: config.maxHp,
    maxHp: config.maxHp,
    position: { x, y, z },
    state: 'IDLE',
    castCooldownSec: 1.5,
    teleportCooldownSec: 0,
    shieldActive: true,
  };
}

export interface PriestTickResult {
  readonly damageDealtToPlayer: number;
  readonly message: string | null;
  readonly spawnedMinions: number;
  readonly teleportedTo: { x: number; y: number; z: number } | null;
}

export function tickPriestAI(
  priest: PriestInstance,
  playerPos: { x: number; y: number; z: number },
  deltaSec: number,
  config: PriestConfig = DEFAULT_PRIEST_CONFIG,
): PriestTickResult {
  if (priest.hp <= 0) {
    priest.state = 'DEAD';
    return { damageDealtToPlayer: 0, message: null, spawnedMinions: 0, teleportedTo: null };
  }

  const dx = playerPos.x - priest.position.x;
  const dz = playerPos.z - priest.position.z;
  const dist = Math.hypot(dx, dz);

  priest.castCooldownSec = Math.max(0, priest.castCooldownSec - deltaSec);
  priest.teleportCooldownSec = Math.max(0, priest.teleportCooldownSec - deltaSec);

  // 1. Evasione: se il giocatore è troppo vicino (< 2.2m) e il teletrasporto è pronto
  if (dist < 2.2 && priest.teleportCooldownSec <= 0) {
    priest.state = 'TELEPORT';
    priest.teleportCooldownSec = config.teleportCooldownSec;

    // Teletrasporto all'indietro
    const nx = dist > 0.001 ? dx / dist : 0;
    const nz = dist > 0.001 ? dz / dist : 1;
    const targetX = priest.position.x - nx * 6.0;
    const targetZ = priest.position.z - nz * 6.0;

    priest.position.x = targetX;
    priest.position.z = targetZ;

    return {
      damageDealtToPlayer: 0,
      message: 'Il Sacerdote di Anubi si dissolve nelle ombre e riappare a distanza.',
      spawnedMinions: 0,
      teleportedTo: { x: targetX, y: priest.position.y, z: targetZ },
    };
  }

  // 2. Lancio Incantesimo Dardo della Duat
  if (priest.castCooldownSec <= 0 && dist < 12.0) {
    priest.state = 'CAST_DUAT_BOLT';
    priest.castCooldownSec = config.castIntervalSec;
    return {
      damageDealtToPlayer: 18,
      message: 'Il Sacerdote di Anubi scaglia un dardo d ombra dalla Duat!',
      spawnedMinions: 0,
      teleportedTo: null,
    };
  }

  priest.state = 'IDLE';
  return { damageDealtToPlayer: 0, message: null, spawnedMinions: 0, teleportedTo: null };
}
