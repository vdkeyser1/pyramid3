/**
 * Scopo: DivineBlessingOverlay — UI per la scelta tra due benedizioni divine
 *        presso gli altari sacri degli dei egizi.
 * Ownership: UI.
 */

import type { DivineBlessing } from '@/content/DivineBlessings.js';

export interface DivineBlessingOverlay {
  show(
    offerings: readonly [DivineBlessing, DivineBlessing],
    currentGold: number,
    onSelect: (blessing: DivineBlessing) => void,
    onDismiss?: () => void,
  ): void;
  hide(): void;
  readonly visible: boolean;
  mount(container: HTMLElement): void;
  dispose(): void;
}

export function createDivineBlessingOverlay(): DivineBlessingOverlay {
  let rootEl: HTMLElement | null = null;
  let visible = false;
  let keyHandler: ((e: KeyboardEvent) => void) | null = null;

  function renderCard(b: DivineBlessing, index: number, affordable: boolean): string {
    const goldColor = affordable ? '#D4A05A' : '#AA3322';
    return `
      <div class="blessing-card" data-index="${index}" style="
        background: radial-gradient(circle at top, #2A1F16, #140E0A);
        border: 2px solid ${affordable ? '#8C6834' : '#553322'};
        border-radius: 8px; padding: 20px; text-align: center;
        cursor: ${affordable ? 'pointer' : 'not-allowed'};
        transition: transform 0.15s ease, border-color 0.15s ease;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6); display: flex; flex-direction: column; justify-content: space-between;
      ">
        <div>
          <div style="font-size: 11px; letter-spacing: 2px; color: #9C826A; text-transform: uppercase; margin-bottom: 4px;">
            [${index + 1}] ${b.epithet}
          </div>
          <h3 style="margin: 0 0 12px 0; color: #F5E5C9; font-family: 'Cinzel', serif; font-size: 18px;">
            ${b.name}
          </h3>
          <p style="color: #C2B099; font-size: 13px; line-height: 1.5; margin: 0 0 16px 0;">
            ${b.description}
          </p>
        </div>
        <div style="
          background: rgba(0,0,0,0.4); border-radius: 4px; padding: 8px;
          color: ${goldColor}; font-weight: bold; font-size: 14px;
        ">
          Offerta: ${b.goldCost} Oro ${affordable ? '' : '(Insuff.)'}
        </div>
      </div>
    `;
  }

  const overlay: DivineBlessingOverlay = {
    get visible(): boolean {
      return visible;
    },

    show(
      offerings: readonly [DivineBlessing, DivineBlessing],
      currentGold: number,
      onSelect: (blessing: DivineBlessing) => void,
      onDismiss?: () => void,
    ): void {
      if (!rootEl) return;
      visible = true;

      const [b1, b2] = offerings;
      const aff1 = currentGold >= b1.goldCost;
      const aff2 = currentGold >= b2.goldCost;

      rootEl.innerHTML = `
        <div style="
          position: fixed; inset: 0; background: rgba(8, 6, 5, 0.85);
          backdrop-filter: blur(4px); z-index: 10000;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          color: #E8D0B0; font-family: sans-serif;
        ">
          <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="font-family: 'Cinzel', serif; font-size: 28px; color: #D4A05A; margin: 0 0 6px 0; letter-spacing: 1px;">
              Altare degli Dei della Duat
            </h2>
            <p style="color: #9C826A; margin: 0; font-size: 14px;">
              Consacra un offerta per ricevere un favore divino durante la tua discesa
            </p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; width: 680px; max-width: 90vw;">
            ${renderCard(b1, 0, aff1)}
            ${renderCard(b2, 1, aff2)}
          </div>

          <button id="btn-dismiss-blessing" style="
            margin-top: 24px; background: transparent; border: 1px solid #5A402A;
            color: #8C7560; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;
          ">
            Rinuncia all offerta [ESC]
          </button>
        </div>
      `;

      rootEl.style.display = 'block';
      rootEl.setAttribute('aria-hidden', 'false');

      // Click card 1
      const card1 = rootEl.querySelectorAll('.blessing-card')[0];
      if (card1 && aff1) {
        card1.addEventListener('click', () => {
          overlay.hide();
          onSelect(b1);
        });
      }

      // Click card 2
      const card2 = rootEl.querySelectorAll('.blessing-card')[1];
      if (card2 && aff2) {
        card2.addEventListener('click', () => {
          overlay.hide();
          onSelect(b2);
        });
      }

      // Dismiss
      const dismissBtn = rootEl.querySelector('#btn-dismiss-blessing');
      dismissBtn?.addEventListener('click', () => {
        overlay.hide();
        onDismiss?.();
      });

      // Keyboard navigation
      if (keyHandler) {
        window.removeEventListener('keydown', keyHandler);
      }
      keyHandler = (e: KeyboardEvent) => {
        if (e.key === '1' && aff1) {
          overlay.hide();
          onSelect(b1);
        } else if (e.key === '2' && aff2) {
          overlay.hide();
          onSelect(b2);
        } else if (e.key === 'Escape') {
          overlay.hide();
          onDismiss?.();
        }
      };
      window.addEventListener('keydown', keyHandler);
    },

    hide(): void {
      visible = false;
      if (rootEl) {
        rootEl.style.display = 'none';
        rootEl.setAttribute('aria-hidden', 'true');
      }
      if (keyHandler) {
        window.removeEventListener('keydown', keyHandler);
        keyHandler = null;
      }
    },

    mount(container: HTMLElement): void {
      if (rootEl) return;
      rootEl = document.createElement('div');
      rootEl.id = 'divine-blessing-overlay';
      rootEl.setAttribute('aria-hidden', 'true');
      rootEl.style.display = 'none';
      container.appendChild(rootEl);
    },

    dispose(): void {
      overlay.hide();
      if (rootEl?.parentNode) {
        rootEl.parentNode.removeChild(rootEl);
      }
      rootEl = null;
    },
  };

  return overlay;
}
