/**
 * W-5: Caricatore centralizzato per artefatti 3D dal registro.
 * Cache per id — ogni clone è indipendente (position/rotation proprie).
 * Usa il DRACOLoader già configurato in AssetLoader (public/draco/).
 * Ritorna null se il file GLB manca — nessun crash, solo prop assente.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { ArtifactDef } from '@/content/ArtifactRegistry.js';

let _loader: GLTFLoader | null = null;

function getLoader(): GLTFLoader {
  if (_loader) return _loader;
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const gltf = new GLTFLoader();
  gltf.setDRACOLoader(draco);
  _loader = gltf;
  return _loader;
}

const _cache = new Map<string, THREE.Group>();

/**
 * Carica e restituisce un clone del modello GLB.
 * Il clone ha già scala e ombre configurate dal def.
 */
export async function loadArtifact(def: ArtifactDef): Promise<THREE.Group | null> {
  const cached = _cache.get(def.id);
  if (cached) {
    const clone = cached.clone(true);
    return clone;
  }

  try {
    const gltf = await getLoader().loadAsync(def.url);
    const root = gltf.scene;
    root.scale.setScalar(def.scale);
    root.name = def.id;
    if (def.yRotation) root.rotation.y = def.yRotation;

    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });

    _cache.set(def.id, root);
    return root.clone(true);
  } catch {
    return null;
  }
}

/** Svuota la cache (usato al dispose del renderer). */
export function clearArtifactCache(): void {
  _cache.clear();
}
