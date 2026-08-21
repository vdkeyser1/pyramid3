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

    // Le clip vanno conservate a parte: clonando la scena si perdono, e i
    // nemici animati ne hanno bisogno per l'AnimationMixer.
    if (gltf.animations.length > 0) {
      _clips.set(def.id, gltf.animations);
    }

    _cache.set(def.id, root);
    return root.clone(true);
  } catch {
    return null;
  }
}

/**
 * Clip di animazione del GLB, indicizzate per id artefatto.
 * `loadArtifact` restituisce solo `gltf.scene` e scartava `gltf.animations`:
 * per i nemici animati le clip servono, quindi vengono conservate qui.
 */
const _clips = new Map<string, THREE.AnimationClip[]>();

/**
 * Clip di animazione di un artefatto già caricato.
 * Array vuoto se il modello è statico o non ancora caricato.
 */
export function getArtifactClips(id: string): readonly THREE.AnimationClip[] {
  return _clips.get(id) ?? [];
}

/** Svuota la cache (usato al dispose del renderer). */
export function clearArtifactCache(): void {
  _cache.clear();
  _clips.clear();
}
