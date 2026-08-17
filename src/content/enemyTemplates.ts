/**
 * Scopo: template nemici per il Threat Director (G-11) — la tabella di
 *        apparizione graduale per piramide/piano (§8.5 del Master Bible).
 * Ownership: contenuto immutabile. Consumato da Director/InitialEncounterPlanner
 *        e dal futuro EnemySpawnSystem.
 * Invarianti:
 *   - ogni archetipo ha budget, fascia di piani e flag telegrafo coerenti con
 *     il protocollo delle Tre Apparizioni (§2.2);
 *   - i tier crescono con i piani: nessun tier 2 prima del piano 3, nessun
 *     tier 3 prima del piano 5 (salvo ROYAL_MUMMY boss del piano 4+);
 *   - WITNESS non è mai in un template di spawn (non attaccabile).
 * Failure mode: un template con fascia vuota viene semplicemente filtrato da
 *   availableTemplates() — nessun crash.
 */

import { ENEMIES, type EnemyArchetype } from '@/content/enemies.js';

/** Template di spawn per il Director: tipo, costo di budget, fascia piani. */
export interface EnemyTemplate {
  readonly type: string;
  readonly budgetCost: number;
  readonly minFloor: number;
  readonly maxFloor: number;
  readonly telegraphed: boolean;
}

const WITNESS: EnemyArchetype = 'WITNESS';

/**
 * Template di spawn per gli archetipi combattibili, allineati alla curva
 * didattica: piano 1 = solo SCARAB + MUMMY (guardiana), piano 2 introduce
 * COBRA, piano 3 i tier 2, piano 5 i tier 3.
 */
export const ENEMY_TEMPLATES: readonly EnemyTemplate[] = [
  {
    type: 'SCARAB',
    budgetCost: 2,
    minFloor: 1,
    maxFloor: 10,
    telegraphed: true,
  },
  {
    type: 'MUMMY',
    budgetCost: 4,
    minFloor: 1,
    maxFloor: 10,
    telegraphed: true,
  },
  {
    type: 'COBRA',
    budgetCost: 3,
    minFloor: 2,
    maxFloor: 10,
    telegraphed: false,
  },
  {
    type: 'SHABTI',
    budgetCost: 8,
    minFloor: 3,
    maxFloor: 10,
    telegraphed: true,
  },
  {
    type: 'PRIEST',
    budgetCost: 7,
    minFloor: 3,
    maxFloor: 10,
    telegraphed: true,
  },
  {
    type: 'SOBEK_SPAWN',
    budgetCost: 12,
    minFloor: 4,
    maxFloor: 10,
    telegraphed: true,
  },
  {
    type: 'ROYAL_MUMMY',
    budgetCost: 16,
    minFloor: 4,
    maxFloor: 10,
    telegraphed: true,
  },
];

/** Archetipi esclusi dallo spawn via Director (non attaccabili per design). */
export const NON_SPAWNABLE_ARCHETYPES: readonly EnemyArchetype[] = [WITNESS];

/**
 * Verifica di coerenza: ogni template referenzia un archetipo esistente e
 * combattibile. Usata dai test (invariante, non snapshot).
 */
export function validateEnemyTemplates(): readonly string[] {
  const problems: string[] = [];
  for (const template of ENEMY_TEMPLATES) {
    const archetype = template.type as EnemyArchetype;
    if (!Object.hasOwn(ENEMIES, archetype)) {
      problems.push(`template sconosciuto: ${template.type}`);
      continue;
    }
    if (NON_SPAWNABLE_ARCHETYPES.includes(archetype)) {
      problems.push(`archetipo non attaccabile in template: ${template.type}`);
    }
    if (template.minFloor < 1 || template.maxFloor < template.minFloor) {
      problems.push(`fascia piani invalida: ${template.type}`);
    }
  }
  return problems;
}
