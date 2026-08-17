/**
 * Scopo: definizioni di contenuto dei nemici (data-driven).
 * Ownership: pura, immutabile. La simulazione legge, non scrive.
 *
 * Ogni nemico definisce: HP, danno, velocità, AI, telegrafi, affinity torcia.
 */

export type EnemyArchetype =
  | 'SCARAB'
  | 'MUMMY'
  | 'COBRA'
  | 'SHABTI'
  | 'PRIEST'
  | 'SOBEK_SPAWN'
  | 'ROYAL_MUMMY'
  | 'WITNESS';

export type EnemyState =
  | 'DORMANT'
  | 'SUSPICIOUS'
  | 'ALERTED'
  | 'ENGAGE'
  | 'RECOVER'
  | 'SEARCH'
  | 'FLEE'
  | 'DEATH';

export interface AttackDef {
  readonly name: string;
  readonly damageHp: number;
  readonly anticipationTicks: number;
  readonly activeTicks: number;
  readonly recoveryTicks: number;
  readonly range: number;
  readonly arcDeg: number;
  readonly isHeavy: boolean;
  readonly stagger: number;
  readonly audioCue: string;
}

export interface EnemyDef {
  readonly archetype: EnemyArchetype;
  readonly name: string;
  readonly baseHp: number;
  readonly speedMps: number;
  readonly torchAffinity: number;
  readonly viewAngleDeg: number;
  readonly viewRadiusM: number;
  readonly hearRadiusM: number;
  readonly attacks: readonly AttackDef[];
  readonly isCorrupted: boolean;
  readonly tier: 1 | 2 | 3;
}

const TICK_60 = (s: number): number => Math.round(s * 60);

export const ENEMIES: Record<EnemyArchetype, EnemyDef> = {
  SCARAB: {
    archetype: 'SCARAB',
    name: 'Scarabeo di Lapislazzuli',
    baseHp: 20,
    speedMps: 6.0,
    torchAffinity: 0.7,
    viewAngleDeg: 90,
    viewRadiusM: 8,
    hearRadiusM: 5,
    isCorrupted: false,
    tier: 1,
    attacks: [{
      name: 'Carica Ondulante',
      damageHp: 5,
      anticipationTicks: TICK_60(0.4),
      activeTicks: TICK_60(0.2),
      recoveryTicks: TICK_60(0.8),
      range: 2.0,
      arcDeg: 45,
      isHeavy: false,
      stagger: 0.3,
      audioCue: 'scarab_click',
    }],
  },
  MUMMY: {
    archetype: 'MUMMY',
    name: 'Mummia Dormiente',
    baseHp: 60,
    speedMps: 1.5,
    torchAffinity: -0.6,
    viewAngleDeg: 90,
    viewRadiusM: 3,
    hearRadiusM: 8,
    isCorrupted: false,
    tier: 1,
    attacks: [
      {
        name: 'Fendente a Due Mani',
        damageHp: 15,
        anticipationTicks: TICK_60(1.0),
        activeTicks: TICK_60(0.3),
        recoveryTicks: TICK_60(1.5),
        range: 2.5,
        arcDeg: 120,
        isHeavy: true,
        stagger: 1.0,
        audioCue: 'mummy_creak',
      },
      {
        name: 'Presa',
        damageHp: 8,
        anticipationTicks: TICK_60(0.6),
        activeTicks: TICK_60(0.1),
        recoveryTicks: TICK_60(0.5),
        range: 1.5,
        arcDeg: 30,
        isHeavy: false,
        stagger: 0.5,
        audioCue: 'mummy_grab',
      },
    ],
  },
  COBRA: {
    archetype: 'COBRA',
    name: 'Cobra delle Fessure',
    baseHp: 25,
    speedMps: 4.0,
    torchAffinity: 0.0,
    viewAngleDeg: 60,
    viewRadiusM: 5,
    hearRadiusM: 10,
    isCorrupted: false,
    tier: 1,
    attacks: [{
      name: 'Morso Rapido',
      damageHp: 8,
      anticipationTicks: TICK_60(0.30),
      activeTicks: TICK_60(0.1),
      recoveryTicks: TICK_60(1.5),
      range: 1.8,
      arcDeg: 20,
      isHeavy: false,
      stagger: 0.3,
      audioCue: 'snake_hiss',
    }],
  },
  SHABTI: {
    archetype: 'SHABTI',
    name: 'Shabti Guardiano',
    baseHp: 100,
    speedMps: 2.0,
    torchAffinity: 0.0,
    viewAngleDeg: 90,
    viewRadiusM: 6,
    hearRadiusM: 10,
    isCorrupted: false,
    tier: 2,
    attacks: [
      {
        name: 'Colpo di Scettro',
        damageHp: 20,
        anticipationTicks: TICK_60(0.8),
        activeTicks: TICK_60(0.2),
        recoveryTicks: TICK_60(0.6),
        range: 2.5,
        arcDeg: 60,
        isHeavy: true,
        stagger: 0.8,
        audioCue: 'shabti_swing',
      },
      {
        name: 'Carica di Pietra',
        damageHp: 25,
        anticipationTicks: TICK_60(1.2),
        activeTicks: TICK_60(0.5),
        recoveryTicks: TICK_60(2.5),
        range: 6.5,
        arcDeg: 30,
        isHeavy: true,
        stagger: 2.0,
        audioCue: 'shabti_charge',
      },
    ],
  },
  PRIEST: {
    archetype: 'PRIEST',
    name: 'Sacerdote delle Ceneri',
    baseHp: 80,
    speedMps: 3.0,
    torchAffinity: 0.0,
    viewAngleDeg: 90,
    viewRadiusM: 12,
    hearRadiusM: 6,
    isCorrupted: true,
    tier: 2,
    attacks: [{
      name: 'Dardo d\'Ombra',
      damageHp: 12,
      anticipationTicks: TICK_60(0.6),
      activeTicks: TICK_60(0.3),
      recoveryTicks: TICK_60(0.8),
      range: 20,
      arcDeg: 10,
      isHeavy: false,
      stagger: 0.3,
      audioCue: 'priest_dart',
    }],
  },
  SOBEK_SPAWN: {
    archetype: 'SOBEK_SPAWN',
    name: 'Figlio di Sobek',
    baseHp: 200,
    speedMps: 5.0,
    torchAffinity: 0.0,
    viewAngleDeg: 90,
    viewRadiusM: 10,
    hearRadiusM: 6,
    isCorrupted: false,
    tier: 2,
    attacks: [
      {
        name: 'Morso Rotante',
        damageHp: 35,
        anticipationTicks: TICK_60(0.9),
        activeTicks: TICK_60(0.4),
        recoveryTicks: TICK_60(1.2),
        range: 2.0,
        arcDeg: 60,
        isHeavy: true,
        stagger: 1.5,
        audioCue: 'sobek_bite',
      },
      {
        name: 'Colpo di Coda',
        damageHp: 20,
        anticipationTicks: TICK_60(0.9),
        activeTicks: TICK_60(0.2),
        recoveryTicks: TICK_60(1.0),
        range: 3.0,
        arcDeg: 360,
        isHeavy: false,
        stagger: 0.6,
        audioCue: 'sobek_tail',
      },
    ],
  },
  ROYAL_MUMMY: {
    archetype: 'ROYAL_MUMMY',
    name: 'Mummia Reale',
    baseHp: 300,
    speedMps: 2.5,
    torchAffinity: -0.6,
    viewAngleDeg: 120,
    viewRadiusM: 10,
    hearRadiusM: 8,
    isCorrupted: true,
    tier: 3,
    attacks: [
      {
        name: 'Fendente Reale',
        damageHp: 25,
        anticipationTicks: TICK_60(0.8),
        activeTicks: TICK_60(0.3),
        recoveryTicks: TICK_60(1.0),
        range: 3.0,
        arcDeg: 140,
        isHeavy: true,
        stagger: 1.0,
        audioCue: 'royal_swing',
      },
      {
        // isCorrupted=true: maledizione soprannaturale a media distanza.
        // Anticip. lunghissima (1.4 s) → pesantemente telegrafata, ma inparabile.
        // Incentiva il giocatore ad avvicinarsi e sfidare il corpo a corpo.
        name: 'Maledizione dei Faraoni',
        damageHp: 18,
        anticipationTicks: TICK_60(1.4),
        activeTicks: TICK_60(0.25),
        recoveryTicks: TICK_60(2.2),
        range: 9.0,
        arcDeg: 10,
        isHeavy: true,
        stagger: 1.5,
        audioCue: 'royal_curse',
      },
    ],
  },
  WITNESS: {
    archetype: 'WITNESS',
    name: 'Il Testimone',
    baseHp: Number.POSITIVE_INFINITY,
    speedMps: 0.5,
    torchAffinity: 0.0,
    viewAngleDeg: 0,
    viewRadiusM: 0,
    hearRadiusM: 0,
    isCorrupted: true,
    tier: 3,
    attacks: [],
  },
};
