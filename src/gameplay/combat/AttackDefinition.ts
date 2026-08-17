/**
 * Scopo: definizione data-driven di un attacco (§31.1).
 * Ownership: contenuto immutabile. Le istanze stanno in content/.
 * Invarianti:
 *   - tutti i tempi in tick interi;
 *   - punishWindowTicks > 0 implica segnale visivo (MIG-04).
 */

export type AttackShapeKind = 'ARC' | 'LINE' | 'SPHERE' | 'CONE';

export interface AttackShapeDefinition {
  readonly kind: AttackShapeKind;
  readonly radiusM: number;
  /** Solo per ARC: arco in gradi. */
  readonly arcDeg?: number;
  /** Solo per LINE/CONE: lunghezza in metri. */
  readonly lengthM?: number;
}

export interface AttackDefinition {
  readonly id: string;
  readonly anticipationTicks: number;
  readonly activeTicks: number;
  readonly recoveryTicks: number;
  readonly damage: number;
  readonly stagger: number;
  readonly shape: AttackShapeDefinition;
  readonly interruptibleUntilTick: number;
  readonly audioCue: string;
  readonly effectCue: string;
  /** Finestra di punizione segnalata visivamente (MIG-04, v4). */
  readonly punishWindowTicks: number;
  /** Parabilità: true se può essere parato dal giocatore. */
  readonly parryable: boolean;
  /** Direzione di knockback relativa all'attaccante. */
  readonly knockbackDirectionLocal: { readonly x: number; readonly z: number };
  readonly knockbackForce: number;
}
