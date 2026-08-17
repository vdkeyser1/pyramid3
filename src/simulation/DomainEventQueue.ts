/**
 * Scopo: coda di eventi di dominio per il frame corrente.
 * Ownership: Simulation.
 *
 * Eventi: emissione sincrona, consumo una volta per frame.
 * Consumatori: UI (HUD), audio, salvataggio, replay.
 */

export type DomainEventKind =
  | 'PLAYER_DAMAGED'
  | 'PLAYER_HEALED'
  | 'PLAYER_DIED'
  | 'ENEMY_SPAWNED'
  | 'ENEMY_DIED'
  | 'ENEMY_STATE_CHANGED'
  | 'ITEM_PICKED_UP'
  | 'ITEM_USED'
  | 'TORCH_STATE_CHANGED'
  | 'TORCH_FUEL_LOW'
  | 'TORCH_FUEL_EMPTY'
  | 'NOISE_PULSE'
  | 'LIGHT_PULSE'
  | 'KA_ECHO_PULSE'
  | 'DIG_PROGRESS'
  | 'DIG_COMPLETE'
  | 'TREASURE_FOUND'
  | 'MAP_FOUND'
  | 'BRAZIER_LIT'
  | 'MAP_REVEAL'
  | 'DARKNESS_RELIEF'
  | 'ROOM_ENTERED'
  | 'ROOM_EXITED'
  | 'FLOOR_COMPLETE'
  | 'DARKNESS_THRESHOLD'
  | 'WITNESS_APPROACH';

export interface DomainEvent {
  readonly kind: DomainEventKind;
  readonly entityId?: number;
  readonly position?: { readonly x: number; readonly y: number; readonly z: number };
  readonly data?: Record<string, unknown>;
}

export interface DomainEventQueue {
  /** Emette un evento per questo frame. */
  emit(event: DomainEvent): void;

  /** Restituisce tutti gli eventi del frame corrente. */
  flush(): readonly DomainEvent[];

  /** Svuota la coda (chiamato a inizio frame). */
  clearFrame(): void;
}

export function createDomainEventQueue(): DomainEventQueue {
  let events: DomainEvent[] = [];

  return {
    emit(event: DomainEvent): void {
      events.push(event);
    },

    flush(): readonly DomainEvent[] {
      return events;
    },

    clearFrame(): void {
      events = [];
    },
  };
}
