/**
 * Scopo: risoluzione della parata (gap reale "Parry system" — G-03 residuo).
 *        Finestra di parata, arco frontale e stordimento condivisi tra i
 *        runtime nemici (GenericEncounterRuntime, MummyEncounterRuntime).
 *        Modulo puro: nessuna dipendenza da three/DOM, testabile in node.
 * Ownership: gameplay/combat.
 * Invarianti:
 *   - convenzione angolare IDENTICA ad AttackHitResolver: yaw 0 = verso -z,
 *     angolo = atan2(-dx, -dz) in gradi normalizzati [-180, 180];
 *   - parata possibile SOLO entro PARRY_WINDOW_MS dalla pressione del tasto;
 *   - arco frontale simmetrico: il nemico deve essere entro PARRY_ARC_DEG/2
 *     dal fronte del player (la simmetria rende innocua l'ambiguità di segno).
 * Failure mode: finestra scaduta ⇒ parata impossibile (nessun costo, nessun
 *        messaggio fuorviante).
 */

export const PARRY_WINDOW_MS = 350;
/** I-frame concessi dalla parata riuscita (protegge dagli altri nemici). */
export const PARRY_IFRAME_MS = 300;
/** Stordimento del nemico parato in tick a 60 Hz (0.8 s). */
export const PARRY_STAGGER_TICKS = 48;
/** Arco frontale totale in gradi entro cui la parata riesce. */
export const PARRY_ARC_DEG = 100;

/** True se la finestra di parata è ancora aperta. */
export function parryWindowActive(parryUntilMs: number, nowMs: number): boolean {
  return nowMs < parryUntilMs;
}

/** Normalizza un angolo in gradi in [-180, 180). */
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export interface ParryVector2 {
  readonly x: number;
  readonly z: number;
}

/** Angolo player→nemico nella convenzione del resolver (yaw 0 = verso -z). */
export function angleToEnemyDeg(player: ParryVector2, enemy: ParryVector2): number {
  return normalizeDeg(Math.atan2(-(enemy.x - player.x), -(enemy.z - player.z)) * (180 / Math.PI));
}

/**
 * True se il nemico è entro `arcDeg` dal fronte del player.
 * `playerYawRad` è lo yaw della camera nella convenzione del resolver
 * (0 = verso -z; lo stesso usato da withinArc e dal runtime generico).
 */
export function isEnemyInParryArc(
  playerYawRad: number,
  player: ParryVector2,
  enemy: ParryVector2,
  arcDeg = PARRY_ARC_DEG,
): boolean {
  const yawDeg = (playerYawRad * 180) / Math.PI;
  const diff = Math.abs(normalizeDeg(angleToEnemyDeg(player, enemy) - yawDeg));
  return diff <= arcDeg / 2;
}
