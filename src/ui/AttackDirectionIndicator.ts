/**
 * AC-03 — Attack Direction Indicator
 * Overlay SVG con frecce direzionali che indicano da dove arriva l'attacco.
 * Supporta 8 direzioni (N, NE, E, SE, S, SW, W, NW).
 * Rispetta prefers-reduced-motion (0ms fade, solo icona lampeggiante breve).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Angolo in gradi (0 = attacco da Nord, 90 = da Est). */
export type AttackAngleDeg = number;

export interface AttackDirectionIndicatorOptions {
  /** Durata fade out (ms). Default 800. */
  readonly fadeMs?: number;
  /** Lato freccia (px). Default 48. */
  readonly arrowSize?: number;
  /** Colore freccia. Default '#e55'. */
  readonly arrowColor?: string;
  /** Forza reduced-motion override (altrimenti rilevato da matchMedia). */
  readonly reducedMotion?: boolean;
}

// ── Implementazione ───────────────────────────────────────────────────────────

export class AttackDirectionIndicator {
  private readonly container: HTMLElement;
  private readonly arrows = new Map<number, SVGSVGElement>();
  private readonly timers  = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly fadeMs: number;
  private readonly arrowColor: string;
  private readonly arrowSize: number;
  private readonly reducedMotion: boolean;

  constructor(
    mountTarget: HTMLElement,
    options: AttackDirectionIndicatorOptions = {},
  ) {
    this.fadeMs       = options.fadeMs      ?? 800;
    this.arrowSize    = options.arrowSize   ?? 48;
    this.arrowColor   = options.arrowColor  ?? '#e55';
    this.reducedMotion = options.reducedMotion
      ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.container = document.createElement('div');
    this.container.setAttribute('aria-hidden', 'true');
    this.container.style.cssText =
      'position:absolute;inset:0;pointer-events:none;overflow:hidden;';

    mountTarget.appendChild(this.container);

    // Pre-crea frecce per tutte le 8 direzioni
    for (const deg of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const svg = this.buildArrow(deg);
      this.container.appendChild(svg);
      this.arrows.set(deg, svg);
    }
  }

  /**
   * Mostra la freccia per la direzione indicata.
   * @param angleDeg 0 = attacco proveniente da Nord, senso orario.
   */
  show(angleDeg: AttackAngleDeg): void {
    const snapped = this.snapTo8(angleDeg);
    const el = this.arrows.get(snapped);
    if (!el) return;

    const prev = this.timers.get(snapped);
    if (prev !== undefined) clearTimeout(prev);

    el.style.opacity = '1';
    el.style.transition = this.reducedMotion
      ? 'none'
      : `opacity ${this.fadeMs}ms ease-out`;

    const displayMs = this.reducedMotion ? 200 : this.fadeMs;
    const timer = setTimeout(() => {
      el.style.opacity = '0';
      this.timers.delete(snapped);
    }, displayMs);
    this.timers.set(snapped, timer);
  }

  /** Nasconde subito tutti gli indicatori. */
  hideAll(): void {
    for (const [deg, el] of this.arrows) {
      const prev = this.timers.get(deg);
      if (prev !== undefined) { clearTimeout(prev); this.timers.delete(deg); }
      el.style.opacity = '0';
    }
  }

  dispose(): void {
    this.hideAll();
    this.container.remove();
  }

  // ── Privati ──────────────────────────────────────────────────────────────────

  /** Snappa l'angolo al multiplo di 45° più vicino. */
  private snapTo8(angleDeg: number): number {
    const n = ((angleDeg % 360) + 360) % 360;
    return (Math.round(n / 45) * 45) % 360;
  }

  private buildArrow(deg: number): SVGSVGElement {
    const S = this.arrowSize;

    // Posizione al bordo dello schermo nella direzione indicata
    // deg=0 → freccia in cima (N), deg=90 → destra (E)
    const rad = ((deg - 90) * Math.PI) / 180;
    const cx  = 50 + Math.cos(rad) * 42; // % dal centro
    const cy  = 50 + Math.sin(rad) * 42;

    const ns  = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width',   String(S));
    svg.setAttribute('height',  String(S));
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.style.cssText = [
      'position:absolute',
      `left:calc(${cx}% - ${S / 2}px)`,
      `top:calc(${cy}% - ${S / 2}px)`,
      'opacity:0',
      `transform:rotate(${deg}deg)`,
      `filter:drop-shadow(0 0 4px ${this.arrowColor})`,
    ].join(';');

    const poly = document.createElementNS(ns, 'polygon');
    // Freccia che punta verso l'alto (Nord); ruotata via CSS
    poly.setAttribute('points', '24,4 44,44 24,34 4,44');
    poly.setAttribute('fill', this.arrowColor);
    svg.appendChild(poly);

    return svg;
  }
}
