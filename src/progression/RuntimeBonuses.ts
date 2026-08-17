import { getNodeLevel, type ProgressionState } from '@/progression/KaProgression.js';

const RESPIRO_LUNGO_CAPACITY_BONUS_PER_LEVEL = 0.1;
const KA_ROBUSTO_HP_BONUS_PER_LEVEL = 10;

export interface RuntimeBonuses {
  readonly torchCapacitySeconds: number;
  readonly playerMaxHp: number;
  readonly hasAnubiRevive: boolean;
  readonly startsWithStaff: boolean;
  readonly guaranteesEarlyMap: boolean;
  /** Passo di Bastet: 0.12s di i-frame nella parte centrale della schivata. */
  readonly hasDodgeIFrames: boolean;
  /** Occhio del Ladro: tell visivo sui contenitori/siti pericolosi. */
  readonly hasLootDangerTell: boolean;
  /** Sangue di Ra: consente di deporre una maledizione per piano (vs: flag). */
  readonly canDeposeCurse: boolean;
}

export function getRuntimeBonuses(
  state: ProgressionState,
  baseTorchCapacitySeconds: number,
  basePlayerMaxHp: number,
): RuntimeBonuses {
  const torchCapacityLevels = getNodeLevel('respiro-lungo', state);
  const maxHpLevels = getNodeLevel('ka-robusto', state);

  return {
    torchCapacitySeconds: Math.round(
      baseTorchCapacitySeconds * (1 + torchCapacityLevels * RESPIRO_LUNGO_CAPACITY_BONUS_PER_LEVEL),
    ),
    playerMaxHp: basePlayerMaxHp + maxHpLevels * KA_ROBUSTO_HP_BONUS_PER_LEVEL,
    hasAnubiRevive: getNodeLevel('patto-di-anubi', state) > 0,
    startsWithStaff: getNodeLevel('mano-ferma', state) > 0,
    guaranteesEarlyMap: getNodeLevel('memoria-di-thoth', state) > 0,
    hasDodgeIFrames: getNodeLevel('passo-di-bastet', state) > 0,
    hasLootDangerTell: getNodeLevel('occhio-del-ladro', state) > 0,
    canDeposeCurse: getNodeLevel('sangue-di-ra', state) > 0,
  };
}

export function remapCurrentValueToNewMaximum(
  currentValue: number,
  previousMaximum: number,
  nextMaximum: number,
): number {
  if (nextMaximum <= 0) {
    return 0;
  }

  const clampedCurrentValue = Math.max(0, currentValue);
  if (previousMaximum <= 0) {
    return Math.min(nextMaximum, clampedCurrentValue);
  }

  const ratio = Math.max(0, Math.min(1, clampedCurrentValue / previousMaximum));
  return Math.min(nextMaximum, ratio * nextMaximum);
}
