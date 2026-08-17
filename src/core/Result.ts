/**
 * Scopo: tipo di ritorno per operazioni fallibili, senza eccezioni fra i layer.
 * Ownership: nessuna. Tipo puro, zero dipendenze.
 * Invarianti: `ok === true` implica `value`; `ok === false` implica `error`.
 * Failure mode: nessuno. Non usare per errori di programmazione (quelli restano throw).
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Unwrap con messaggio esplicito. Usare solo dove il fallimento è un bug, non uno stato. */
export function expectOk<T, E>(r: Result<T, E>, message: string): T {
  if (r.ok) return r.value;
  throw new Error(`${message}: ${JSON.stringify(r.error)}`);
}
