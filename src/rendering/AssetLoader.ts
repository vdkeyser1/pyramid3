/**
 * Scopo: caricatore asset 3D (G-17) — GLTF/GLB con cache, preload opzionale e
 *        fallback silenzioso: se il modello non esiste o fallisce, il chiamante
 *        riceve null e usa le primitive placeholder esistenti (G-23).
 * Ownership: rendering (adapter verso three/examples). Nessun layer puro lo
 *        importa: solo il renderer.
 * Invarianti:
 *   - stesso path ⇒ stessa Promise (cache Map, nessun doppio fetch);
 *   - mai throw verso il chiamante: errore ⇒ null;
 *   - il path è sempre relativo alla root del sito (public/).
 * Failure mode: fetch 404 o parse fallito ⇒ null + log warning.
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const loader = new GLTFLoader();
// gltf-transform (scripts/optimize-assets.mjs) comprime i GLB con Meshopt:
// senza decoder il GLTFLoader rifiuta i file compressi. Il modulo carica il
// .wasm in automatico (Vite lo copia in dist/ via import.meta.url).
loader.setMeshoptDecoder(MeshoptDecoder);

/** Cache delle Promise: path → modello caricato (o null su errore). */
const cache = new Map<string, Promise<GLTF | null>>();

function loadInternal(path: string): Promise<GLTF | null> {
  return new Promise((resolve) => {
    loader.load(
      path,
      (gltf: GLTF) => {
        resolve(gltf);
      },
      undefined,
      (error: unknown) => {
        // Silenzioso ma tracciabile: il fallback alle primitive è il design.
        console.warn(`[AssetLoader] caricamento fallito: ${path}`, error);
        resolve(null);
      },
    );
  });
}

export interface AssetLoader {
  /** Carica un modello .glb (cache). Ritorna null se assente/fallito. */
  load(path: string): Promise<GLTF | null>;
  /** Precarica un set di path (per evitare stutter a runtime). */
  preload(paths: readonly string[]): Promise<void>;
  /** True se il path è in cache (già caricato o fallito). */
  has(path: string): boolean;
  /** Svuota la cache (per cambi piano / test). */
  clear(): void;
}

export function createAssetLoader(): AssetLoader {
  return {
    load(path: string): Promise<GLTF | null> {
      const cached = cache.get(path);
      if (cached) {
        return cached;
      }
      const promise = loadInternal(path);
      cache.set(path, promise);
      return promise;
    },

    async preload(paths: readonly string[]): Promise<void> {
      await Promise.all(paths.map((path) => this.load(path)));
    },

    has(path: string): boolean {
      return cache.has(path);
    },

    clear(): void {
      cache.clear();
    },
  };
}
