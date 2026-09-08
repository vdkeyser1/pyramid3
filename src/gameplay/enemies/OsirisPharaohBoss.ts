/**
 * OsirisPharaohBoss.ts
 * Logica e State Machine del Boss Finale al Piano 20: "Il Faraone Eterno della Duat".
 * Boss a 3 fasi evolutive:
 * - Fase 1: Il Flagello di Ra (Mischia pesante con Scettro Heqa e Flagello Nekhakha)
 * - Fase 2: Il Risveglio dei Cento Shabti (Vortici di sabbia e servitori)
 * - Fase 3: L'Eclissi Primordiale (Raggi solari oscuri, furia ad alta velocità)
 */

export type PharaohPhase = 1 | 2 | 3;

export interface PharaohBossState {
  hp: number;
  readonly maxHp: number;
  phase: PharaohPhase;
  position: { x: number; y: number; z: number };
  attackCooldownSec: number;
  isInvulnerable: boolean;
  sandstormActive: boolean;
}

export function createPharaohBoss(
  x: number = 0,
  y: number = 0,
  z: number = 0,
  maxHp: number = 650,
): PharaohBossState {
  return {
    hp: maxHp,
    maxHp,
    phase: 1,
    position: { x, y, z },
    attackCooldownSec: 2.0,
    isInvulnerable: false,
    sandstormActive: false,
  };
}

export interface PharaohTickResult {
  readonly damageDealt: number;
  readonly phaseChanged: boolean;
  readonly message: string | null;
  readonly triggerSandstorm: boolean;
}

export function tickPharaohBoss(
  boss: PharaohBossState,
  playerPos: { x: number; y: number; z: number },
  deltaSec: number,
): PharaohTickResult {
  if (boss.hp <= 0) {
    return {
      damageDealt: 0,
      phaseChanged: false,
      message: 'Il Faraone Eterno si dissolve in una pioggia di luce dorata.',
      triggerSandstorm: false,
    };
  }

  // Transizione fasi basata sulla percentuale di salute
  const hpRatio = boss.hp / boss.maxHp;
  let phaseChanged = false;
  let triggerSandstorm = false;

  if (hpRatio <= 0.33 && boss.phase < 3) {
    boss.phase = 3;
    boss.isInvulnerable = false;
    boss.sandstormActive = true;
    phaseChanged = true;
    triggerSandstorm = true;
    return {
      damageDealt: 0,
      phaseChanged: true,
      message: 'FASE 3: L Eclissi della Duat! Il Faraone scatena la furia solare.',
      triggerSandstorm: true,
    };
  } else if (hpRatio <= 0.66 && boss.phase < 2) {
    boss.phase = 2;
    boss.sandstormActive = true;
    phaseChanged = true;
    triggerSandstorm = true;
    return {
      damageDealt: 0,
      phaseChanged: true,
      message: 'FASE 2: Il Faraone evoca la Tempesta di Sabbia dei Guardiani Shabti!',
      triggerSandstorm: true,
    };
  }

  boss.attackCooldownSec = Math.max(0, boss.attackCooldownSec - deltaSec);

  const dx = playerPos.x - boss.position.x;
  const dz = playerPos.z - boss.position.z;
  const dist = Math.hypot(dx, dz);

  if (boss.attackCooldownSec <= 0) {
    if (boss.phase === 1 && dist < 3.2) {
      boss.attackCooldownSec = 2.2;
      return {
        damageDealt: 25,
        phaseChanged: false,
        message: 'Il Faraone colpisce con il Flagello di Nekhakha!',
        triggerSandstorm: false,
      };
    } else if (boss.phase === 2 && dist < 8.0) {
      boss.attackCooldownSec = 2.8;
      return {
        damageDealt: 20,
        phaseChanged: false,
        message: 'Il Faraone scaglia un vortice di sabbia acuminata!',
        triggerSandstorm: false,
      };
    } else if (boss.phase === 3) {
      boss.attackCooldownSec = 1.6;
      return {
        damageDealt: 32,
        phaseChanged: false,
        message: 'RAGGIO SOLARE OSCURO: Il Faraone scatena il giudizio di Ra!',
        triggerSandstorm: false,
      };
    }
  }

  return {
    damageDealt: 0,
    phaseChanged,
    message: null,
    triggerSandstorm,
  };
}
