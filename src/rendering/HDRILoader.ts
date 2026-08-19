/**
 * W-1 — Caricamento HDRI per l'illuminazione basata su immagine (IBL).
 *
 * Scopo: converte un file .hdr equirettangolare in una environment map
 *        pre-filtrata (PMREM), usata da tutti i MeshStandardMaterial per
 *        riflessioni e luce ambientale credibili.
 * Ownership: rendering. Consumato da ThreeRendererService (fire-and-forget).
 * Invarianti:
 *   - solo backend WebGL2 (PMREMGenerator richiede WebGLRenderer);
 *   - la texture HDR sorgente viene rilasciata subito dopo il pre-filtraggio;
 *   - il chiamante è proprietario della envMap restituita (deve fare dispose).
 * Failure mode: file assente o formato non valido → null, il renderer resta
 *   sulla env map procedurale (nessun crash, nessun degrado visibile bloccante).
 */

import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { PMREMGenerator } from 'three';
import type { WebGLRenderer, Texture } from 'three';

export interface HDRIResult {
  envMap: Texture;
}

export async function loadHDRI(
  renderer: WebGLRenderer,
  url: string,
): Promise<HDRIResult | null> {
  try {
    // HDRLoader sostituisce RGBELoader, deprecato da three r18x.
    const loader = new HDRLoader();
    const hdrTexture = await loader.loadAsync(url);

    const pmrem = new PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
    pmrem.dispose();
    hdrTexture.dispose();

    return { envMap };
  } catch {
    return null;
  }
}
