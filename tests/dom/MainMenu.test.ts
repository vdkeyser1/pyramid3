/**
 * Test DOM del menu principale (G-09/G-20) sotto happy-dom.
 * Verifica struttura, contenuto informativo e callbacks senza browser reale.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { createMainMenu, type MainMenu } from '@/ui/MainMenu.js';

function mountMenu(): { menu: MainMenu; container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const menu = createMainMenu();
  menu.mount(container);
  return { menu, container };
}

function findMenuRoot(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>('#main-menu');
  if (!root) {
    throw new Error('#main-menu non trovato nel DOM');
  }
  return root;
}

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent.includes(text),
  );
  if (!button) {
    throw new Error(`bottone con testo "${text}" non trovato`);
  }
  return button;
}

describe('MainMenu', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('è nascosto di default e si mostra con show()', () => {
    const { menu, container } = mountMenu();
    const root = findMenuRoot(container);

    expect(menu.visible).toBe(false);
    expect(root.style.display).toBe('none');

    menu.show({ fragments: 0, pyramidsUnlocked: 1, bestiaryEntries: 0 });
    expect(menu.visible).toBe(true);
    expect(root.style.display).toBe('flex');

    menu.hide();
    expect(menu.visible).toBe(false);
    expect(root.style.display).toBe('none');
  });

  it('mostra i Frammenti del profilo quando disponibili', () => {
    const { menu, container } = mountMenu();

    menu.show({ fragments: 42, pyramidsUnlocked: 1, bestiaryEntries: 0 });
    expect(container.textContent).toContain('Frammenti di Ka: 42');
  });

  it('segnala il profilo non disponibile quando fragments è null', () => {
    const { menu, container } = mountMenu();

    menu.show({ fragments: null, pyramidsUnlocked: 1, bestiaryEntries: 0 });
    expect(container.textContent).toContain('Profilo non disponibile');
  });

  it('descrive il bestiario quando ci sono voci sbloccate', () => {
    const { menu, container } = mountMenu();

    menu.show({ fragments: 0, pyramidsUnlocked: 2, bestiaryEntries: 3 });
    expect(container.textContent).toContain('Piramidi sbloccate: 2');
    expect(container.textContent).toContain('Bestiario: 3 voci');
  });

  it('il click su INIZIA LA DISCESA invoca onStartRun', () => {
    const { menu, container } = mountMenu();
    let started = false;
    menu.onStartRun = () => {
      started = true;
    };
    menu.show({ fragments: 0, pyramidsUnlocked: 1, bestiaryEntries: 0 });

    findButtonByText(container, 'INIZIA').click();
    expect(started).toBe(true);
  });

  it('i bottoni Impostazioni e Progressione invocano i rispettivi callback', () => {
    const { menu, container } = mountMenu();
    let settingsOpened = false;
    let progressionOpened = false;
    menu.onOpenSettings = () => {
      settingsOpened = true;
    };
    menu.onOpenProgression = () => {
      progressionOpened = true;
    };
    menu.show({ fragments: 0, pyramidsUnlocked: 1, bestiaryEntries: 0 });

    findButtonByText(container, 'Impostazioni').click();
    expect(settingsOpened).toBe(true);

    findButtonByText(container, 'Progressione').click();
    expect(progressionOpened).toBe(true);
  });

  it('applyPresentation scala il testo con textScale', () => {
    const { menu, container } = mountMenu();
    menu.show({ fragments: 0, pyramidsUnlocked: 1, bestiaryEntries: 0 });

    menu.applyPresentation({
      textScale: 1.4,
      highContrast: false,
      colorBlindMode: 'none',
    });
    const root = findMenuRoot(container);
    expect(root.style.fontSize).toBe('1.4em');
  });

  it('dispose rimuove il pannello dal DOM', () => {
    const { menu, container } = mountMenu();
    menu.dispose();

    expect(container.querySelector('#main-menu')).toBeNull();
    expect(menu.visible).toBe(false);
  });
});
