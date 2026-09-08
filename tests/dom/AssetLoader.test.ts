/**
 * Test DOM dell'AssetLoader (G-17): cache, fallback su errore, clear.
 * Eseguito sotto happy-dom. Il GLTFLoader usa fetch: lo mockiamo per
 * simulare 404 (asset assente) senza rete reale.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createAssetLoader } from '@/rendering/AssetLoader.js';

function mockFetch404(): void {
  vi.stubGlobal('fetch', vi.fn(() => {
    return Promise.resolve(new Response('not found', { status: 404, statusText: 'Not Found' }));
  }));
}

describe('AssetLoader (G-17)', () => {
  beforeEach(() => {
    mockFetch404();
  });

  it('carica un modello con cache: stesso path ⇒ stessa Promise', () => {
    const loader = createAssetLoader();
    const first = loader.load('assets/does-not-exist.glb');
    const second = loader.load('assets/does-not-exist.glb');

    expect(loader.has('assets/does-not-exist.glb')).toBe(true);
    expect(first).toBe(second);
  });

  it('fallisce silenziosamente a null per asset inesistenti', async () => {
    const loader = createAssetLoader();
    const result = await loader.load('assets/definitely-missing.glb');

    expect(result).toBeNull();
  });

  it('preload non lancia per path inesistenti e popola la cache', async () => {
    const loader = createAssetLoader();
    await loader.preload(['assets/a.glb', 'assets/b.glb', 'assets/c.glb']);

    expect(loader.has('assets/a.glb')).toBe(true);
    expect(loader.has('assets/b.glb')).toBe(true);
    expect(loader.has('assets/c.glb')).toBe(true);
  });

  it('setProgressCallback riceve aggiornamenti durante preload', async () => {
    const loader = createAssetLoader();
    const events: string[] = [];
    loader.setProgressCallback((_loaded, _total, path) => {
      events.push(path);
    });
    await loader.preload(['assets/p.glb']);
    expect(events.length).toBeGreaterThan(0);
    loader.setProgressCallback(null);
  });

  it('clear svuota la cache', () => {
    const loader = createAssetLoader();
    void loader.load('assets/x.glb');
    expect(loader.has('assets/x.glb')).toBe(true);

    loader.clear();
    expect(loader.has('assets/x.glb')).toBe(false);
  });
});
