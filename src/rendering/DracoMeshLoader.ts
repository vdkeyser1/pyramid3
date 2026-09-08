/**
 * R-05 — Draco Mesh Loader
 * Wrapper per DRACOLoader di Three.js con cache singleton e fallback su GLTFLoader
 * standard. Riduce i GLB nemici del 90–95% in dimensione file.
 *
 * Il decoder WASM Draco (~150 KB) viene caricato una volta sola e condiviso
 * tra tutti i GLTFLoader istanziati. Il path del decoder punta alla directory
 * pubblica copiata da three/examples/jsm/libs/draco/.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { createLogger } from '@/core/Logger.js';

const log = createLogger('DracoMeshLoader');

// ── Singleton ──────────────────────────────────────────────────────────────

let _dracoLoader: DRACOLoader | null = null;
let _gltfLoader: GLTFLoader | null = null;

const _cache = new Map<string, THREE.Group>();

/**
 * Il path deve puntare alla directory che contiene draco_decoder.wasm
 * (copiata da node_modules/three/examples/jsm/libs/draco/ in public/draco/).
 */
const DRACO_DECODER_PATH = '/draco/';

// ── API ─────────────────────────────────────────────────────────────────────

export interface DracoLoadResult {
  readonly scene: THREE.Group;
  readonly fromCache: boolean;
}

/**
 * Carica un GLB (opzionalmente compresso con Draco) e ne ritorna la scena.
 * Il risultato viene clonato dalla cache per consentire istanze multiple.
 */
export async function loadDracoGLB(
  path: string,
): Promise<DracoLoadResult> {
  // Cache hit → clone
  const cached = _cache.get(path);
  if (cached) {
    return { scene: cached.clone(true), fromCache: true };
  }

  const loader = getGLTFLoader();

  return new Promise<DracoLoadResult>((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const scene = gltf.scene;
        // Prepara le mesh per shadow casting
        scene.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = false;
          }
        });
        _cache.set(path, scene);
        log.debug(`Loaded Draco GLB: ${path}`);
        resolve({ scene: scene.clone(true), fromCache: false });
      },
      undefined,
      (err: unknown) => {
        log.warn(`Failed to load Draco GLB: ${path}`, err as Record<string, unknown>);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Pre-carica un batch di GLB in parallelo (da chiamare durante lo splash screen).
 */
export async function preloadDracoGLBs(paths: readonly string[]): Promise<void> {
  await Promise.allSettled(paths.map((p) => loadDracoGLB(p)));
}

/** Libera la cache e dispone il decoder Draco. */
export function disposeDracoLoader(): void {
  _cache.clear();
  _dracoLoader?.dispose();
  _dracoLoader = null;
  _gltfLoader = null;
}

// ── Internals ──────────────────────────────────────────────────────────────

function getDracoLoader(): DRACOLoader {
  if (!_dracoLoader) {
    _dracoLoader = new DRACOLoader();
    _dracoLoader.setDecoderPath(DRACO_DECODER_PATH);
    // Pre-fetch del WASM decoder in background
    _dracoLoader.preload();
  }
  return _dracoLoader;
}

function getGLTFLoader(): GLTFLoader {
  if (!_gltfLoader) {
    _gltfLoader = new GLTFLoader();
    _gltfLoader.setDRACOLoader(getDracoLoader());
  }
  return _gltfLoader;
}
