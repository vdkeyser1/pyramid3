/**
 * G-07 — Run Timer HUD
 * Mostra il tempo trascorso nella run corrente.
 * Layer UI: usa Date.now() e requestAnimationFrame (non simulazione).
 *
 * Il timer si aggiorna ogni frame via rAF; si può mettere in pausa/riprendere.
 * Resiste a restart multipli e stop senza errori.
 */

// ── Implementazione ───────────────────────────────────────────────────────────

export class RunTimer {
  private readonly el: HTMLElement;

  private startMs:         number | null = null;
  private pausedAtMs:      number | null = null;
  /** Millisecondi accumulati durante le pause. */
  private pauseOffsetMs = 0;
  private rafId: number | null = null;

  constructor(mountTarget: HTMLElement) {
    this.el = document.createElement('div');
    this.el.setAttribute('aria-label', 'Durata run');
    this.el.setAttribute('role', 'timer');
    this.el.style.cssText = [
      'position:absolute',
      'top:12px',
      'right:12px',
      'font-family:monospace',
      'font-size:13px',
      'font-variant-numeric:tabular-nums',
      'color:#ecd9a0',
      'text-shadow:0 1px 3px rgba(0,0,0,0.8)',
      'pointer-events:none',
      'user-select:none',
      'letter-spacing:0.05em',
    ].join(';');
    this.el.textContent = '00:00';
    mountTarget.appendChild(this.el);
  }

  /** Avvia il timer (o riprende da pausa). Noop se già in corsa. */
  start(): void {
    if (this.startMs === null) {
      // Prima avvio
      this.startMs      = Date.now();
      this.pauseOffsetMs = 0;
      this.pausedAtMs   = null;
    } else if (this.pausedAtMs !== null) {
      // Ripresa da pausa: accumula il gap
      this.pauseOffsetMs += Date.now() - this.pausedAtMs;
      this.pausedAtMs = null;
    } else {
      return; // già in corsa
    }
    this.scheduleTick();
  }

  /** Mette in pausa il timer. Noop se già in pausa o non avviato. */
  pause(): void {
    if (this.startMs === null || this.pausedAtMs !== null) return;
    this.pausedAtMs = Date.now();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // Aggiorna il display con il tempo esatto al momento della pausa
    this.el.textContent = formatTime(this.elapsedMs);
  }

  /** Ferma e azzera il timer. */
  reset(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.startMs      = null;
    this.pausedAtMs   = null;
    this.pauseOffsetMs = 0;
    this.el.textContent = '00:00';
  }

  /** Millisecondi trascorsi dall'avvio (escluse le pause). */
  get elapsedMs(): number {
    if (this.startMs === null) return 0;
    const ref = this.pausedAtMs ?? Date.now();
    return ref - this.startMs - this.pauseOffsetMs;
  }

  dispose(): void {
    this.reset();
    this.el.remove();
  }

  private readonly tick = (): void => {
    if (this.pausedAtMs !== null) return;
    this.el.textContent = formatTime(this.elapsedMs);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private scheduleTick(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(this.tick);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ms: number): string {
  const totalS = Math.floor(ms / 1000);
  const m      = Math.floor(totalS / 60);
  const s      = totalS % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
