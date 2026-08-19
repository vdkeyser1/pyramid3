/**
 * E-02 — Enemy Encounter Object Pool
 * Pool di oggetti per GenericEncounterState: riduce le allocazioni durante
 * spawn/despawn dei nemici nel corso di un piano.
 *
 * Uso:
 *   const pool = new EnemyEncounterPool(64);
 *   const state = pool.acquire({ enemyType: 'GUARD', roomId: 'r12', hp: 50, maxHp: 50 });
 *   // ... usa state ...
 *   pool.release(state);     // reset e reintrodotto nel pool
 *   pool.releaseAll();       // a fine piano
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type EncounterTag = 'IDLE' | 'PURSUING' | 'ATTACKING' | 'DORMANT' | 'DEAD';

export interface GenericEncounterState {
  enemyType:   string;
  roomId:      string;
  hp:          number;
  maxHp:       number;
  stateTag:    EncounterTag;
  ticksAlive:  number;
  alertRadius: number;
  dropWeight:  number;
}

const DEFAULTS: GenericEncounterState = {
  enemyType:   '',
  roomId:      '',
  hp:          0,
  maxHp:       0,
  stateTag:    'IDLE',
  ticksAlive:  0,
  alertRadius: 6,
  dropWeight:  1,
};

// ── Pool ──────────────────────────────────────────────────────────────────────

export class EnemyEncounterPool {
  private readonly free:    GenericEncounterState[] = [];
  private readonly inUse = new Set<GenericEncounterState>();
  private readonly maxSize: number;

  /**
   * @param initialSize Oggetti pre-allocati all'avvio (default 64).
   * @param maxSize     Limite massimo del pool (default 256).
   *                    Sopra questo, release() abbandona l'oggetto al GC.
   */
  constructor(initialSize = 64, maxSize = 256) {
    this.maxSize = maxSize;
    for (let i = 0; i < initialSize; i++) {
      this.free.push(this.alloc());
    }
  }

  /**
   * Preleva uno stato dal pool e lo inizializza con i valori forniti.
   * Crea un nuovo oggetto se il pool è vuoto.
   */
  acquire(init: Partial<GenericEncounterState> = {}): GenericEncounterState {
    const s = this.free.pop() ?? this.alloc();
    Object.assign(s, DEFAULTS, init);
    this.inUse.add(s);
    return s;
  }

  /**
   * Rilascia uno stato (reset + reinserimento nel pool).
   * Noop se lo stato non è in uso (doppio release sicuro).
   */
  release(state: GenericEncounterState): void {
    if (!this.inUse.delete(state)) return;
    this.wipe(state);
    if (this.free.length < this.maxSize) {
      this.free.push(state);
    }
    // Oltre maxSize: abbandona al GC
  }

  /**
   * Rilascia tutti gli stati attivi.
   * Da chiamare a fine piano o reset completo.
   */
  releaseAll(): void {
    for (const s of [...this.inUse]) this.release(s);
  }

  get activeCount(): number { return this.inUse.size; }
  get freeCount():   number { return this.free.length; }
  get totalPooled(): number { return this.inUse.size + this.free.length; }

  private alloc(): GenericEncounterState {
    return { ...DEFAULTS };
  }

  private wipe(s: GenericEncounterState): void {
    Object.assign(s, DEFAULTS);
  }
}
