/**
 * Scopo: fonte unica dei branded type procedurali condivisi tra generatore,
 * validatore e sistemi runtime che referenziano stanze.
 */

export type RoomId = number & { readonly __brand: 'RoomId' };

export function roomId(value: number): RoomId {
  return value as RoomId;
}

/** Durata di simulazione in tick interi (60 Hz) — mai secondi float nella logica. */
export type Ticks = number & { readonly __brand: 'Ticks' };

export function ticks(value: number): Ticks {
  return value as Ticks;
}
