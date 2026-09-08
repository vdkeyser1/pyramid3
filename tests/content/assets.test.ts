import { describe, expect, it } from 'vitest';
import {
  enemyAssetFor,
  landmarkAssetFor,
  validateAssetManifest,
  ENEMY_ASSETS,
  LANDMARK_ASSETS,
} from '@/content/assets.js';

describe('AssetManifest (G-17)', () => {
  it('tutti gli archetipi hanno una voce di manifest valida', () => {
    expect(validateAssetManifest()).toEqual([]);
  });

  it('copre tutti i 9 archetipi nemici', () => {
    expect(ENEMY_ASSETS).toHaveLength(9);
    for (const archetype of ['SCARAB', 'MUMMY', 'COBRA', 'SHABTI', 'PRIEST', 'SOBEK_SPAWN', 'ROYAL_MUMMY', 'ANUBIS_EXECUTIONER', 'WITNESS']) {
      expect(enemyAssetFor(archetype as never)).not.toBeNull();
    }
  });

  it('WITNESS è l unico archetipo senza modello (non attaccabile)', () => {
    expect(enemyAssetFor('WITNESS')?.modelPath).toBeNull();
    expect(enemyAssetFor('SCARAB')?.modelPath).not.toBeNull();
    expect(enemyAssetFor('MUMMY')?.modelPath).not.toBeNull();
  });

  it('i path puntano a public/assets/ e le scale sono positive', () => {
    for (const entry of ENEMY_ASSETS) {
      if (entry.modelPath !== null) {
        expect(entry.modelPath.startsWith('assets/')).toBe(true);
      }
      expect(entry.scale).toBeGreaterThan(0);
    }
  });

  it('i landmark con asset dichiarato hanno famiglia e scala valide', () => {
    const withModel = LANDMARK_ASSETS.filter((entry) => entry.modelPath !== null);
    expect(withModel.length).toBeGreaterThanOrEqual(4);
    for (const entry of withModel) {
      expect(entry.modelPath?.startsWith('assets/')).toBe(true);
      expect(['altar', 'brazier', 'glyph', 'obelisk', 'portal', 'relic', 'sarcophagus', 'statue', 'well']).toContain(entry.kind);
    }
  });

  it('ogni landmark critico ha una voce nel manifest', () => {
    for (const id of ['braciere-eterno', 'geroglifico-luminoso', 'obelisco-spezzato', 'sarcofago-aperto', 'statua-anubi']) {
      expect(landmarkAssetFor(id)).not.toBeNull();
    }
  });
});
