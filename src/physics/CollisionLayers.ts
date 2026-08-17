/**
 * Scopo: costanti per i layer di collisione Rapier (InteractionGroups).
 * Ownership: pura. Riferimento condiviso da tutti i sistemi fisici.
 *
 * Il formato InteractionGroups è un intero a 32 bit:
 *   - bit 16-31: groups (membership, chi sono)
 *   - bit 0-15:  mask (filter, con chi interagisco)
 *
 * Due filtri a e b interagiscono se:
 *   ((a >> 16) & b) != 0 && ((b >> 16) & a) != 0
 *
 * Assegnazione bit:
 *   bit 0: player / corpo del giocatore
 *   bit 1: ambiente / geometria statica
 *   bit 2: nemici / corpi dinamici ostili
 *   bit 3: sensori / trigger (volume detection, no collisione fisica)
 */

/** Bitmask per i layer di membership (groups). */
export const LAYER = {
  PLAYER:   1 << 0, // 1
  ENVIRONMENT: 1 << 1, // 2
  ENEMY:    1 << 2, // 4
  SENSOR:   1 << 3, // 8
} as const;

/** Costruisce un InteractionGroups a partire da groups e mask. */
function interactionGroups(groups: number, mask: number): number {
  return (groups << 16) | (mask & 0xffff);
}

/**
 * Gruppi di interazione predefiniti per entità comuni.
 * Usa `as const` per evitare allocazioni ripetute.
 */
export const INTERACTION_GROUPS = {
  /** Player: interagisce con ambiente, nemici e sensori. */
  PLAYER: interactionGroups(
    LAYER.PLAYER,
    LAYER.ENVIRONMENT | LAYER.ENEMY | LAYER.SENSOR,
  ),

  /** Ambiente statico: interagisce con player e nemici. */
  ENVIRONMENT: interactionGroups(
    LAYER.ENVIRONMENT,
    LAYER.PLAYER | LAYER.ENEMY,
  ),

  /** Nemico: interagisce con player, ambiente e altri nemici. */
  ENEMY: interactionGroups(
    LAYER.ENEMY,
    LAYER.PLAYER | LAYER.ENVIRONMENT | LAYER.ENEMY,
  ),

  /** Sensore: solo detection, interagisce col player. */
  SENSOR: interactionGroups(
    LAYER.SENSOR,
    LAYER.PLAYER,
  ),
} as const;
