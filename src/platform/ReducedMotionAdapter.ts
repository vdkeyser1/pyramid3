/**
 * AC-01 — Reduced Motion Adapter
 * Legge prefers-reduced-motion e notifica i subscriber in tempo reale.
 * Usato da renderer (disabilita postFX), sistema particelle e UI.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReducedMotionListener = (reduced: boolean) => void;

// ── Implementazione ───────────────────────────────────────────────────────────

export class ReducedMotionAdapter {
  private readonly mq: MediaQueryList;
  private readonly listeners = new Set<ReducedMotionListener>();

  constructor() {
    this.mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mq.addEventListener('change', this.handleChange);
  }

  /** True se l'utente ha richiesto riduzione del movimento. */
  get isReduced(): boolean {
    return this.mq.matches;
  }

  /**
   * Registra un listener che viene notificato quando la preferenza cambia.
   * @returns Funzione di cleanup per rimuovere il listener.
   */
  onChange(listener: ReducedMotionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.mq.removeEventListener('change', this.handleChange);
    this.listeners.clear();
  }

  private readonly handleChange = (e: MediaQueryListEvent): void => {
    for (const l of this.listeners) l(e.matches);
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance: ReducedMotionAdapter | null = null;

/** Singleton globale; inizializzato al primo accesso. */
export function getReducedMotionAdapter(): ReducedMotionAdapter {
  return (_instance ??= new ReducedMotionAdapter());
}

/** Dispose e reset del singleton (usato nei test). */
export function disposeReducedMotionAdapter(): void {
  _instance?.dispose();
  _instance = null;
}
