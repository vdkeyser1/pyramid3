import { describe, expect, it } from 'vitest';
import { createRoomNarrativeOverlay } from '@/ui/RoomNarrativeOverlay.js';

describe('RoomNarrativeOverlay — UI Storytelling di Stanza e Segreti (DOM)', () => {
  it('crea, mostra ed esegue il fade dell overlay narrativo', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const overlay = createRoomNarrativeOverlay(container);
    expect(overlay.root.id).toBe('room-narrative-overlay');
    expect(overlay.root.style.opacity).toBe('0');

    overlay.show({
      title: 'Camera di Menfi',
      description: 'L odore di mirra e loto riempie la sala.',
      atmosphericClue: 'Un soffio d aria fresca filtra da nord.',
    });

    expect(overlay.root.style.opacity).toBe('1');
    expect(overlay.root.textContent).toContain('Camera di Menfi');
    expect(overlay.root.textContent).toContain('mirra e loto');

    overlay.showSecretDiscovery('Varco di Horus', 'Hai trovato la cripta sotto il basamento.');
    expect(overlay.root.textContent).toContain('SEGRETO ARCHEOLOGICO');

    overlay.hide();
    expect(overlay.root.style.opacity).toBe('0');

    overlay.dispose();
  });
});
