import { describe, expect, it } from 'vitest';
import { resolveLandmarkPlaceholder } from '@/content/LandmarkPlaceholders.js';

describe('resolveLandmarkPlaceholder', () => {
  it('assicura affordance distinte per i landmark critici', () => {
    expect(resolveLandmarkPlaceholder('braciere-eterno', 'OPTIONAL').kind).toBe('brazier');
    expect(resolveLandmarkPlaceholder('portale-sigillato', 'EXIT').kind).toBe('portal');
    expect(resolveLandmarkPlaceholder('geroglifico-luminoso', 'MAP').kind).toBe('glyph');
  });

  it('ripiega sul ruolo quando il landmark non ha override dedicato', () => {
    const treasure = resolveLandmarkPlaceholder('reperto-sconosciuto', 'TREASURE');
    const combat = resolveLandmarkPlaceholder('reperto-sconosciuto', 'COMBAT');

    expect(treasure.kind).toBe('sarcophagus');
    expect(combat.kind).toBe('statue');
  });
});
