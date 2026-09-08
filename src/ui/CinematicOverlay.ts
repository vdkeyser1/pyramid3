/**
 * Scopo: overlay cinematografico del gioco (G-15 V5, parziale) — vignettatura
 *        noir + grana + "respiro" dell'oscurità. DOM puro con pointer-events:
 *        none: zero costo GPU, zero interferenza con input/pointer lock.
 * Ownership: ui. Consumato da GameApplication; dispose rimuove dal DOM.
 * Invarianti:
 *   - non intercetta mai eventi (pointer-events: none);
 *   - il grain usa un pattern CSS deterministico (niente animazioni costose);
 *   - l'intensità del respiro è pilotata dal chiamante (0..1).
 * Failure mode: DOM non disponibile ⇒ overlay null (no crash).
 */

export interface CinematicOverlay {
  readonly element: HTMLElement;
  /** Intensità del respiro dell'oscurità 0..1 (0 = pausa/assente). */
  setDarknessBreath(intensity: number): void;
  /** Aggiunge la classe low-hp (bordi porpora pulsanti) quando HP ≤ 30%. */
  setLowHp(low: boolean): void;
  /**
   * Dissolvenza nera (v2): copre la rigenerazione della scena tra i piani
   * con un fade veloce. `opaque` = nero pieno immediato (per il rebuild),
   * poi fadeToBlack(0) lo dissolve. Ritorna senza transizione se null.
   */
  fadeToBlack(opaque: boolean): void;
  /**
   * Mostra una didascalia geroglifica durante il fade nero tra i piani.
   * Passa null per nasconderla.
   */
  setFloorCaption(text: string | null): void;
  dispose(): void;
}

export function createCinematicOverlay(): CinematicOverlay | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const element = document.createElement('div');
  element.id = 'game-cinematic';
  element.style.cssText = `
    position: fixed; inset: 0; z-index: 12;
    pointer-events: none; user-select: none;
    background:
      radial-gradient(ellipse at center, transparent 55%, rgba(11,9,8,0.62) 100%);
  `;

  // Grana: pattern di rumore via box-shadow ripetuti (deterministico, leggero).
  const grain = document.createElement('div');
  grain.style.cssText = `
    position: absolute; inset: 0; opacity: 0.05;
    background-image: repeating-radial-gradient(circle at 17% 32%,
      rgba(255,255,255,0.9) 0 1px, transparent 1px 4px);
    background-size: 220px 220px;
    mix-blend-mode: overlay;
  `;
  element.appendChild(grain);

  // Livello "respiro": si intensifica con il buio (torcia spenta).
  const breath = document.createElement('div');
  breath.id = 'game-cinematic-breath';
  breath.style.cssText = `
    position: absolute; inset: 0; opacity: 0;
    background: radial-gradient(ellipse at center, transparent 40%, rgba(6,5,4,0.85) 100%);
    transition: opacity 1.2s ease;
  `;
  element.appendChild(breath);

  // Livello dissolvenza nera (v2): fade veloce per la transizione tra piani.
  const fade = document.createElement('div');
  fade.id = 'game-cinematic-fade';
  fade.style.cssText = `
    position: absolute; inset: 0; opacity: 0; z-index: 2;
    background: #0B0908; pointer-events: none;
    transition: opacity 0.35s ease;
  `;
  element.appendChild(fade);

  // Didascalia di piano (geroglifici + tema) durante il fade nero.
  const caption = document.createElement('div');
  caption.id = 'game-cinematic-caption';
  caption.setAttribute('aria-hidden', 'true');
  caption.style.cssText = `
    position: absolute; left: 50%; top: 48%; z-index: 3;
    transform: translate(-50%, -50%);
    max-width: min(520px, 88vw); text-align: center;
    font-family: Cinzel, 'Palatino Linotype', serif;
    color: #E8C070; letter-spacing: 0.08em;
    font-size: clamp(15px, 2.4vw, 22px); line-height: 1.55;
    opacity: 0; transition: opacity 0.4s ease;
    text-shadow: 0 2px 18px rgba(0,0,0,0.85);
    white-space: pre-line;
  `;
  element.appendChild(caption);

  document.body.appendChild(element);

  return {
    element,

    setDarknessBreath(intensity: number): void {
      const clamped = Math.max(0, Math.min(1, intensity));
      breath.style.opacity = String(clamped);
    },

    setLowHp(low: boolean): void {
      element.style.boxShadow = low
        ? 'inset 0 0 140px 40px rgba(106,51,77,0.35)'
        : 'inset 0 0 0 0 rgba(106,51,77,0)';
    },

    fadeToBlack(opaque: boolean): void {
      fade.style.opacity = opaque ? '1' : '0';
      if (!opaque) {
        caption.style.opacity = '0';
      }
    },

    setFloorCaption(text: string | null): void {
      if (!text || text.trim().length === 0) {
        caption.textContent = '';
        caption.style.opacity = '0';
        return;
      }
      caption.textContent = text;
      caption.style.opacity = '1';
    },

    dispose(): void {
      element.remove();
    },
  };
}
