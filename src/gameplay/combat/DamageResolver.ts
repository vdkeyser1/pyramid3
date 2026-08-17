/**
 * Scopo: risoluzione deterministica del danno, unica implementazione della formula.
 * Ownership: pura. Nessuna dipendenza da ECS, Rapier o rendering.
 * Invarianti:
 *   - l'armatura è limitata a COMBAT.armorCap: nessuna invulnerabilità per stack;
 *   - il danno finale è un intero >= COMBAT.minimumDamageHp quando l'attacco colpisce;
 *   - stessi input => stesso output (nessun RNG interno).
 * Failure mode: input non finiti vengono normalizzati a 0 e segnalati dal chiamante.
 */

import { COMBAT } from '@/content/balance.js';

export interface DamageInput {
  readonly baseDamageHp: number;
  readonly attackModifier: number;      // innesti, carica, critico
  readonly sourceModifier: number;      // maledizioni, buff del director
  readonly targetArmor: number;         // 0..1 prima del cap
  readonly resistanceMultiplier: number; // 0..n, per tipo di danno
  readonly isCritical: boolean;
  readonly criticalMultiplier: number;
}

export interface DamageOutcome {
  readonly finalDamageHp: number;
  readonly mitigatedHp: number;
  readonly appliedArmor: number;
  readonly wasCritical: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

export function resolveDamage(input: DamageInput): DamageOutcome {
  const critical = input.isCritical ? Math.max(1, finite(input.criticalMultiplier)) : 1;

  const raw =
    finite(input.baseDamageHp) *
    Math.max(0, finite(input.attackModifier)) *
    Math.max(0, finite(input.sourceModifier)) *
    critical;

  const appliedArmor = clamp(finite(input.targetArmor), 0, COMBAT.armorCap);
  const mitigated = raw * (1 - appliedArmor);
  const resisted = mitigated * Math.max(0, finite(input.resistanceMultiplier));

  // Un attacco che colpisce infligge sempre almeno il danno minimo: evita
  // stati in cui il giocatore non può più fare progressi contro un bersaglio.
  const finalDamage = raw <= 0 ? 0 : Math.max(COMBAT.minimumDamageHp, Math.round(resisted));

  return {
    finalDamageHp: finalDamage,
    mitigatedHp: Math.max(0, Math.round(raw - resisted)),
    appliedArmor,
    wasCritical: input.isCritical,
  };
}

/**
 * Ordina i bersagli colpiti in modo deterministico.
 * Senza questo, l'ordine dipende dall'iterazione del motore fisico e il replay
 * diverge: due bersagli con lo stesso HP possono morire in ordine diverso.
 */
export function sortTargetsDeterministically(entityIds: readonly number[]): number[] {
  return entityIds.slice().sort((a, b) => a - b);
}
