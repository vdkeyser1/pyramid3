/**
 * ART-006 — Tipi di runtime per trappole e meccanismo leva.
 *
 * Scopo: definire stati e dati di runtime della macchina a stati TrapSystem,
 *   senza alcuna dipendenza da THREE o da qualsiasi modulo di rendering.
 * Ownership: contenuto. Consumato da TrapSystem (gameplay) e dai test.
 * Invarianti:
 *   - nessun import di librerie esterne (solo tipi TypeScript nativi);
 *   - TrapRuntimeState è un POJO serializzabile (solo primitivi e enum);
 *   - TrapKind corrisponde 1-a-1 alle chiavi di TRAPS in balance.ts.
 * Failure mode: nessuno — solo tipi e interfacce statiche.
 */

export type TrapKind =
  | 'pressurePlate'
  | 'bladePendulum'
  | 'dartLauncher'
  | 'rollingBoulder';

/**
 * Macchina a stati della piastra a pressione.
 *
 * Il pendolo a lama non usa questa enum: è sempre in oscillazione continua e
 * non ha stati discreti — solo un contatore lastDamageElapsed per il cooldown.
 *
 *  ARMED ──(giocatore entra nel raggio)──► EXTEND ──(extendTicks)──► HOLD
 *                                                                        │
 *  ARMED ◄──(cooldownTicks)──── COOLDOWN ◄──(retractTicks)──── RETRACT ◄┘
 */
export type TrapState =
  | 'ARMED'     // In attesa: le punte sono nascoste sotto il pavimento.
  | 'EXTEND'    // Le punte emergono (extendTicks ≈ 9 tick / 0,15 s).
  | 'HOLD'      // Punte estese e ferme; il danno è già stato applicato.
  | 'RETRACT'   // Le punte rientrano (retractTicks ≈ 24 tick / 0,40 s).
  | 'COOLDOWN'; // Attesa prima di riarmarsi (cooldownTicks ≈ 240 tick / 4,0 s).

/**
 * Stato della leva a muro.
 *
 *  READY ──(tryActivateLever)──► PULLING ──(pullDurationTicks)──► PULLED
 *
 * Una volta PULLED la leva rimane tirata per tutta la partita: il passaggio
 * non si richiude. Non esiste transizione di ritorno.
 */
export type LeverState =
  | 'READY'    // Leva disponibile, il giocatore può interagire.
  | 'PULLING'  // Animazione di tiro in corso (pullDurationTicks ≈ 54 tick).
  | 'PULLED';  // Tirata: il sigillo sta scendendo o è già scomparso.

/** Stato di runtime di una singola trappola — POJO serializzabile. */
export interface TrapRuntimeState {
  readonly trapId: string;
  readonly kind: TrapKind;
  /**
   * Stato corrente (solo pressurePlate; il pendolo lo ignora).
   * Il pendolo usa solo lastDamageElapsed per il cooldown del colpo.
   */
  state: TrapState;
  /** Tick rimanenti nella fase corrente. 0 = transizione immediata. */
  timerTicks: number;
  /** Coordinate X del centro della trappola nel sistema di riferimento scena. */
  readonly posX: number;
  /** Coordinate Z del centro della trappola nel sistema di riferimento scena. */
  readonly posZ: number;
  /**
   * Asse di movimento (bladePendulum / dartLauncher / rollingBoulder).
   * 'x' = corridoio est-ovest → oscilla/spara/rotola su Z o lungo X a seconda del kind.
   * 'z' = corridoio nord-sud → analogo.
   */
  readonly corridorAxis: 'x' | 'z';
  /**
   * Semi-corsa del masso (solo rollingBoulder), in metri dal centro.
   * 0 per gli altri kind.
   */
  readonly travelHalfM: number;
  /**
   * Ultimo elapsed-tick in cui la trappola ha inflitto danno.
   * Impedisce colpi ogni tick mentre il giocatore resta nella zona.
   */
  lastDamageElapsed: number;
}

/** Stato di runtime della leva — POJO serializzabile. */
export interface LeverRuntimeState {
  readonly leverId: string;
  state: LeverState;
  /** Tick rimanenti nella fase corrente. */
  timerTicks: number;
  /**
   * Progresso della discesa del sigillo [0..1].
   * 0 = sigillo completamente in posizione chiusa (blocca il passaggio).
   * 1 = sigillo completamente sotto il pavimento (passaggio libero).
   * Aggiornato ogni tick durante la fase PULLED mentre il sigillo scende.
   */
  sealDropProgress: number;
}
