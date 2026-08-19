/**
 * Scopo: maledizioni attive (NEW-3) — meccanica antagonista del nodo
 * "Sangue di Ra" (KaProgression). Quando il player ha canDeposeCurse, alla
 * discesa di ogni piano può deporre UNA maledizione: un'ombra che rende il
 * piano più ostile ma aumenta la ricompensa. Trade-off, mai beneficio puro.
 * Ownership: contenuto immutabile. Consumato da GameApplication (discesa).
 * Invarianti:
 *   - ogni maledizione ha EFFETTO NEGATIVO + RICOMPENSA (trade-off);
 *   - 4 maledizioni, scelta deterministica per piano (hash del floor seed);
 *   - una sola maledizione attiva per piano (flag runtime).
 * Failure mode: stato inesistente → maledizione nulla (piano normale).
 */

import { floorSeed } from '@/content/floorProgression.js';

export type CurseId = 'oscurita-antica' | 'fame-del-deserto' | 'furia-degli-sciacalli' | 'sigillo-di-sobek';

export interface CurseDefinition {
  readonly id: CurseId;
  readonly name: string;
  readonly icon: string;
  /** Effetto negativo sul piano. */
  readonly penalty: string;
  /** Ricompensa per aver affrontato il piano maledetto. */
  readonly reward: string;
}

export const CURSES: readonly CurseDefinition[] = [
  {
    id: 'oscurita-antica',
    name: 'Oscurità Antica',
    icon: '🌑',
    penalty: 'La torcia consuma carburante 25% più in fretta.',
    reward: '+1 Frammento di Ka alla fine del piano.',
  },
  {
    id: 'fame-del-deserto',
    name: 'Fame del Deserto',
    icon: '🐍',
    penalty: 'Il veleno prosciuga: -10 HP massimi per il piano.',
    reward: 'L\'oro raccolto è raddoppiato.',
  },
  {
    id: 'furia-degli-sciacalli',
    name: 'Furia degli Sciacalli',
    icon: '🐺',
    penalty: 'I nemici sono più rapidi e aggressivi.',
    reward: '+1 Frammento di Ka per ogni nemico abbattuto.',
  },
  {
    id: 'sigillo-di-sobek',
    name: 'Sigillo di Sobek',
    icon: '🐊',
    penalty: 'Il danno subito aumenta del 20%.',
    reward: 'Il tesoro finale garantisce un innesto.',
  },
];

/** Maledizione deposta per il piano N (deterministica dal seed del piano). */
export function curseForFloor(baseSeed: number, floorIndex: number): CurseDefinition {
  const seed = floorSeed(baseSeed, floorIndex);
  const index = seed % CURSES.length;
  return CURSES[index] ?? CURSES[0] ?? {
    id: 'oscurita-antica',
    name: 'Oscurità Antica',
    icon: '🌑',
    penalty: 'La torcia consuma carburante 25% più in fretta.',
    reward: '+1 Frammento di Ka alla fine del piano.',
  };
}

export interface ActiveCurse {
  readonly definition: CurseDefinition;
  readonly floorIndex: number;
}

/** Applica gli effetti della maledizione ai parametri del piano. */
export function applyCurseEffects(
  curse: ActiveCurse,
  params: {
    readonly torchDrainRatio: number;
    readonly maxHp: number;
    readonly damageTakenMultiplier: number;
    readonly goldMultiplier: number;
    /** Moltiplicatore budget Director (>1 = più nemici). Default 1. */
    readonly enemyBudgetMultiplier?: number;
    /** Frammenti Ka bonus per nemico ucciso. Default 0. */
    readonly kaPerKillBonus?: number;
  },
): {
  readonly torchDrainRatio: number;
  readonly maxHp: number;
  readonly damageTakenMultiplier: number;
  readonly goldMultiplier: number;
  readonly enemyBudgetMultiplier: number;
  readonly kaPerKillBonus: number;
} {
  const base = {
    torchDrainRatio: params.torchDrainRatio,
    maxHp: params.maxHp,
    damageTakenMultiplier: params.damageTakenMultiplier,
    goldMultiplier: params.goldMultiplier,
    enemyBudgetMultiplier: params.enemyBudgetMultiplier ?? 1,
    kaPerKillBonus: params.kaPerKillBonus ?? 0,
  };
  switch (curse.definition.id) {
    case 'oscurita-antica':
      return { ...base, torchDrainRatio: base.torchDrainRatio * 1.25 };
    case 'fame-del-deserto':
      return { ...base, maxHp: base.maxHp - 10, goldMultiplier: base.goldMultiplier * 2 };
    case 'furia-degli-sciacalli':
      // Nemici più numerosi (+20% budget Director) e ogni uccisione vale 1 Ka.
      return { ...base, enemyBudgetMultiplier: base.enemyBudgetMultiplier * 1.20, kaPerKillBonus: base.kaPerKillBonus + 1 };
    case 'sigillo-di-sobek':
      return { ...base, damageTakenMultiplier: base.damageTakenMultiplier * 1.2 };
  }
}
