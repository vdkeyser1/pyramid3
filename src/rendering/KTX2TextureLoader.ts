/**
 * R-01: KTX2/Basis Universal texture loader.
 *
 * Riduzione VRAM ~10×: le texture KTX2 restano compresse in GPU
 * (ASTC su mobile, BC7 su desktop, ETC2 come fallback WebGL).
 *
 * Ownership: ThreeRendererService e Materials lo usano per caricare
 *            qualsiasi texture PBR (albedo, normal, roughness, AO).
 *
 * Sicurezza: nessun performance.now() qui — questo modulo gira
 * nel renderer, non nella simulazione.
 */

import * as THREE from 'three';
// KTX2Loader è distribuito in three/examples/jsm (stabile da r152).
// Import type-safe: se il progetto compila con paths @/ basta il path npm.
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

export interface KTX2LoadResult {
  readonly texture: THREE.Texture;
  readonly fromCache: boolean;
}

export interface KTX2LoaderOptions {
  /**
   * Percorso assoluto o relativo alla directory con i file
   * `basis_transcoder.js` e `basis_transcoder.wasm`.
   * Default: '/assets/basis/'
   */
  readonly transcoderPath?: string;
}

// ─── Cache LRU semplificata (max 64 texture per floor) ─────────────────────
const MAX_CACHE_SIZE = 64;
const cache = new Map<string, THREE.CompressedTexture | THREE.Texture>();

let sharedLoader: KTX2Loader | null = null;

/**
 * Restituisce (o crea) il KTX2Loader singleton configurato.
 * Deve essere chiamato dal renderer dopo che WebGL/WebGPU è inizializzato.
 */
export function getKTX2Loader(
  renderer: THREE.WebGLRenderer | { gl: WebGLRenderingContext | WebGL2RenderingContext },
  options: KTX2LoaderOptions = {},
): KTX2Loader {
  if (sharedLoader) return sharedLoader;

  const transcoderPath = options.transcoderPath ?? '/assets/basis/';
  const loader = new KTX2Loader();
  loader.setTranscoderPath(transcoderPath);

  // detectSupport() sceglie automaticamente ASTC/BC7/ETC2 in base alla GPU.
  if ('gl' in renderer) {
    loader.detectSupport(renderer as unknown as THREE.WebGLRenderer);
  } else {
    loader.detectSupport(renderer);
  }

  sharedLoader = loader;
  return loader;
}

/**
 * Carica una texture KTX2 con cache condivisa.
 * Fallback: se il `.ktx2` fallisce, prova il sibling `.jpg` / `.png`
 * (utile in dev quando manca toktx o il file non è ancora convertito).
 */
export async function loadKTX2Texture(
  path: string,
  renderer: THREE.WebGLRenderer,
  options: KTX2LoaderOptions = {},
): Promise<KTX2LoadResult> {
  // Prova cache prima
  const cached = cache.get(path);
  if (cached) return { texture: cached, fromCache: true };

  let texture: THREE.Texture;

  if (path.endsWith('.ktx2')) {
    const loader = getKTX2Loader(renderer, options);
    try {
      texture = await new Promise<THREE.CompressedTexture>((resolve, reject) => {
        loader.load(path, resolve, undefined, reject);
      });
    } catch {
      // GAME-ART-010a: fallback raster se KTX2 assente o transcoder KO.
      const rasterPath = await resolveRasterSibling(path);
      if (!rasterPath) throw new Error(`KTX2 e raster mancanti: ${path}`);
      texture = await loadRasterTexture(rasterPath);
    }
  } else {
    texture = await loadRasterTexture(path);
  }

  // Impostazioni standard per tutte le texture PBR
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = path.includes('_albedo') || path.includes('_color')
    ? THREE.SRGBColorSpace
    : THREE.LinearSRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  // Evict LRU se la cache è piena
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) {
      cache.get(firstKey)?.dispose();
      cache.delete(firstKey);
    }
  }

  cache.set(path, texture);
  return { texture, fromCache: false };
}

function loadRasterTexture(path: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(path, resolve, undefined, reject);
  });
}

/** Sibling `.jpg` / `.png` per un path `.ktx2` (stesso basename sotto /textures). */
async function resolveRasterSibling(ktx2Path: string): Promise<string | null> {
  const base = ktx2Path.replace(/\.ktx2$/i, '');
  for (const ext of ['.jpg', '.png'] as const) {
    const candidate = `${base}${ext}`;
    try {
      const res = await fetch(candidate, { method: 'HEAD' });
      if (res.ok) return candidate;
    } catch {
      // Ignora: prova la prossima estensione.
    }
  }
  return null;
}

/**
 * Versione sincrona con fallback procedurale immediato.
 * Usata dove non si può attendere un Promise (init del material).
 * Avvia il caricamento async in background e aggiorna la texture
 * quando disponibile.
 */
export function loadKTX2TextureSync(
  path: string,
  renderer: THREE.WebGLRenderer,
  fallback: () => THREE.Texture,
  options: KTX2LoaderOptions = {},
): THREE.Texture {
  const cached = cache.get(path);
  if (cached) return cached;

  const placeholder = fallback();

  // Caricamento async: aggiorna in-place il placeholder
  loadKTX2Texture(path, renderer, options)
    .then(({ texture }) => {
      // Copia le proprietà rilevanti nel placeholder già assegnato ai materiali.
      // Il transcoder può restituire una texture NON compressa (fallback su GPU
      // senza formati supportati): tipizziamo come Partial così i fallback `??`
      // restano guardie runtime legittime invece di rami irraggiungibili.
      const maybeCompressed = texture as Partial<THREE.CompressedTexture>;
      Object.assign(placeholder, {
        image: texture.image,
        mipmaps: texture.mipmaps,
        isCompressedTexture: maybeCompressed.isCompressedTexture ?? false,
        format: maybeCompressed.format ?? placeholder.format,
        needsUpdate: true,
      });
      texture.dispose(); // Il placeholder ora ha i dati; liberiamo il duplicato
      cache.set(path, placeholder);
    })
    .catch(() => {
      // Silently keep the fallback procedural texture
    });

  return placeholder;
}

/** Svuota cache e dispose di tutte le texture. Chiamare a fine sessione. */
export function disposeKTX2Cache(): void {
  for (const tex of cache.values()) tex.dispose();
  cache.clear();
  sharedLoader?.dispose();
  sharedLoader = null;
}
