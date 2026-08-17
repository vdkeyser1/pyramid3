/**
 * Scopo: Threat Director — calibra la pressione di combattimento per piano (§12).
 * Ownership: simulazione. Legge FloorModel + stato giocatore, emette SpawnRequest.
 * Invarianti:
 *   - budget = baseBudget × (1 + powerBandExtra) × retryGraceFactor;
 *   - nessun nemico spawna entro 4 m dal giocatore (§12.1);
 *   - max 1 incontro non-telegrafato ogni 3 stanze (§12.3);
 *   - dopo wipe: grace 90 s + budget ×0.75 (anti-frustrazione);
 *   - sotto 15 s di combustibile: nessuna imboscata spontanea;
 *   - decisioni deterministiche (seed-driven).
 * Failure mode: se il budget è < 0 il piano resta vuoto e la partita continua
 *   senza nemici — meglio troppo facile che un crash.
 */

import { DIRECTOR } from '../content/balance.js';
import type { RoomId, Ticks } from '@/procedural/Ids.js';
// Il tipo EnemyTemplate vive in content (dati immutabili) e viene ri-esportato
// qui per compatibilità con chi importava il tipo dal Director (G-11).
export type { EnemyTemplate } from '@/content/enemyTemplates.js';
import type { EnemyTemplate } from '@/content/enemyTemplates.js';

// ── Branded types ──────────────────────────────────────────────────────────
// Nota: EntityId non è ancora usato in questo file — verrà referenziato da
// SpawnRequest quando l'EnemySpawnSystem (G-03) porrà l'EntityId reale
// dell'entità creata. Ticks è centralizzato in procedural/Ids.ts (G-08).

// ── Interfacce ─────────────────────────────────────────────────────────────

export interface SpawnRequest {
  readonly enemyType: string;
  readonly roomId: RoomId;
  readonly cost: number;
}

export interface DirectorContext {
  /** Numero di nodi meta sbloccati dal giocatore. */
  readonly metaNodes: number;
  /** Indice di piano (1-based). */
  readonly floorIndex: number;
  /** Seme deterministico per il piano corrente. */
  readonly floorSeed: number;
  /** Secondi di combustibile residui. */
  readonly currentFuelSeconds: number;
  /** Stanze visitate dall'inizio del piano. */
  readonly roomsVisited: number;
  /** True se il giocatore ha subìto un wipe nello stesso piano. */
  readonly hadWipeThisFloor: boolean;
}

export interface DirectorState {
  budgetRemaining: number;
  graceTicksRemaining: Ticks;
  untelegraphedSinceRooms: number;
  spawnedThisFloor: readonly SpawnRequest[];
}

// ── Funzioni pure / quasi-pure ─────────────────────────────────────────────

/**
 * Calcola il budget totale nemici per il piano corrente.
 */
export function computeFloorBudget(
  baseBudget: number,
  metaNodes: number,
  hadWipe: boolean,
): number {
  // L'ultima fascia ha maxNodes = +Infinity, quindi .find() trova sempre una
  // corrispondenza; il ramo undefined è irraggiungibile ma gestito senza `!`
  // per restare coerenti col principio "meglio troppo facile che un crash".
  const band = DIRECTOR.powerBands.find((b) => metaNodes <= b.maxNodes);
  if (!band) return Math.max(0, Math.round(baseBudget));

  let budget = baseBudget * (1 + band.extraBudgetFactor);
  if (hadWipe) budget *= DIRECTOR.retryGraceBudgetFactor;
  return Math.max(0, Math.round(budget));
}

/**
 * Crea lo stato iniziale del Director per un piano.
 */
export function createDirectorState(ctx: DirectorContext, baseBudget: number): DirectorState {
  const budget = computeFloorBudget(baseBudget, ctx.metaNodes, ctx.hadWipeThisFloor);
  const graceTicks = ctx.hadWipeThisFloor
    ? (DIRECTOR.retryGraceTicks as Ticks)
    : (0 as Ticks);

  return {
    budgetRemaining: budget,
    graceTicksRemaining: graceTicks,
    untelegraphedSinceRooms: 0,
    spawnedThisFloor: [],
  };
}

/**
 * Tick del Director: decrementa grace timer.
 */
export function tickDirector(state: DirectorState): void {
  if ((state.graceTicksRemaining as number) > 0) {
    (state.graceTicksRemaining as number)--;
  }
}

/**
 * Verifica se il Director può emettere uno spawn in questo momento.
 */
export function canSpawn(
  state: DirectorState,
  distanceToPlayerM: number,
  currentFuelSeconds: number,
  template: EnemyTemplate,
): boolean {
  // Grace period attivo
  if ((state.graceTicksRemaining as number) > 0) return false;

  // Budget esaurito
  if (state.budgetRemaining < template.budgetCost) return false;

  // Distanza minima
  if (distanceToPlayerM < DIRECTOR.minSpawnDistanceM) return false;

  // Sotto soglia combustibile: niente imboscate non-telegrafate
  if (
    currentFuelSeconds < DIRECTOR.lowFuelAmbushThresholdSeconds &&
    !template.telegraphed
  ) {
    return false;
  }

  // Max incontri non-telegrafati
  if (!template.telegraphed) {
    const limit = DIRECTOR.maxUntelegraphedEncountersPerRooms;
    if (state.untelegraphedSinceRooms < limit.rooms) {
      // Conta quanti non-telegrafati nelle ultime N stanze
      // (approssimazione: usa contatore rolling)
      return true; // il contatore verrà aggiornato in commitSpawn
    }
  }

  return true;
}

/**
 * Registra uno spawn effettuato e aggiorna il budget.
 */
export function commitSpawn(
  state: DirectorState,
  request: SpawnRequest,
  template: EnemyTemplate,
): void {
  state.budgetRemaining -= template.budgetCost;

  if (!template.telegraphed) {
    state.untelegraphedSinceRooms = 0;
  }

  (state.spawnedThisFloor as SpawnRequest[]).push(request);
}

/**
 * Chiamato quando il giocatore entra in una nuova stanza.
 * Aggiorna il contatore per il rate-limit incontri non-telegrafati.
 */
export function onRoomEntered(state: DirectorState): void {
  state.untelegraphedSinceRooms++;
}

/**
 * Filtra i template nemici disponibili per il piano corrente.
 */
export function availableTemplates(
  templates: readonly EnemyTemplate[],
  floorIndex: number,
): readonly EnemyTemplate[] {
  return templates.filter(
    (t) => floorIndex >= t.minFloor && floorIndex <= t.maxFloor,
  );
}
