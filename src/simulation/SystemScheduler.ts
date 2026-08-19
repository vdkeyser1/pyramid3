/**
 * E-03 — System Scheduler
 * Registra sistemi ECS con un intervallo di tick e li esegue solo
 * quando il tick corrente soddisfa la frequenza dichiarata.
 *
 * Invarianti:
 *   - Opera esclusivamente su contatori interi (nessun orologio di sistema).
 *   - Ordine di esecuzione: ordine di registrazione.
 *   - phaseOffset permette di distribuire sistemi con la stessa frequenza su tick diversi.
 *   - Un sistema disabilitato non viene mai chiamato ma resta registrato.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SystemFn = (tick: number) => void;

export interface SystemEntry {
  readonly id: string;
  readonly fn: SystemFn;
  /** Eseguito ogni N tick (1 = ogni tick). Minimo 1. */
  readonly everyNTicks: number;
  /** Offset di fase: il sistema esegue quando (tick − offset) % N === 0. */
  readonly phaseOffset: number;
  enabled: boolean;
}

// ── Implementazione ───────────────────────────────────────────────────────────

export class SystemScheduler {
  private readonly systems = new Map<string, SystemEntry>();
  private _tick = 0;

  get tick(): number {
    return this._tick;
  }

  /**
   * Registra un sistema.
   *
   * @param id           Identificatore univoco (lancia se già presente).
   * @param fn           Funzione di update; riceve il tick corrente.
   * @param everyNTicks  Frequenza di esecuzione (default 1 = ogni tick).
   * @param phaseOffset  Offset iniziale per distribuire sistemi con uguale N.
   */
  register(
    id: string,
    fn: SystemFn,
    everyNTicks = 1,
    phaseOffset = 0,
  ): void {
    if (this.systems.has(id)) {
      throw new Error(`SystemScheduler: sistema "${id}" già registrato`);
    }
    this.systems.set(id, {
      id,
      fn,
      everyNTicks: Math.max(1, Math.floor(everyNTicks)),
      phaseOffset: Math.max(0, Math.floor(phaseOffset)),
      enabled: true,
    });
  }

  /** Rimuove un sistema registrato. */
  unregister(id: string): boolean {
    return this.systems.delete(id);
  }

  /** Abilita o disabilita un sistema senza rimuoverlo. */
  setEnabled(id: string, enabled: boolean): void {
    const entry = this.systems.get(id);
    if (entry) entry.enabled = enabled;
  }

  /**
   * Avanza di un tick ed esegue i sistemi che corrispondono alla frequenza.
   * L'ordine è garantito essere quello di registrazione (Map preserva l'ordine).
   */
  step(): void {
    const t = this._tick;
    for (const entry of this.systems.values()) {
      if (!entry.enabled) continue;
      // (tick - offset) deve essere divisibile per N, con offset >= 0
      if (((t - entry.phaseOffset) % entry.everyNTicks + entry.everyNTicks) % entry.everyNTicks === 0) {
        entry.fn(t);
      }
    }
    this._tick++;
  }

  /**
   * Avanza di N tick (utile per catch-up dopo una pausa).
   */
  stepN(count: number): void {
    for (let i = 0; i < count; i++) this.step();
  }

  /** Lista di tutti i sistemi registrati nell'ordine di registrazione. */
  list(): readonly SystemEntry[] {
    return [...this.systems.values()];
  }

  /** Reset completo: rimuove tutti i sistemi e azzera il tick. */
  reset(): void {
    this.systems.clear();
    this._tick = 0;
  }
}
