/**
 * ART-003 — Animazioni dei nemici.
 *
 * Scopo: pilotare l'AnimationMixer di un nemico a partire dallo stato che il
 *        gameplay già espone (vivo, sveglio, colpito, telegrafo d'attacco).
 *        Prima i GLB erano in scena ma completamente immobili.
 * Ownership: rendering. Un animator per nemico visibile, creato quando il
 *        modello viene agganciato e rilasciato al cambio piano.
 * Invarianti:
 *   - nessun performance.now(): il tempo arriva da update(deltaMs);
 *   - se una clip manca, lo stato ricade su Idle senza lanciare;
 *   - la morte si riproduce una volta sola e resta sull'ultimo frame.
 * Failure mode: modello senza clip ⇒ createEnemyAnimator ritorna null e il
 *   chiamante mantiene l'animazione procedurale di respiro già esistente.
 */

import * as THREE from 'three';

/** Stati visivi, derivati da quelli di gameplay. */
export type EnemyAnimState = 'IDLE' | 'MOVE' | 'ATTACK' | 'HIT' | 'DEATH';

export interface EnemyAnimator {
  /** Cambia stato con crossfade. Ripetere lo stesso stato è un no-op. */
  setState(state: EnemyAnimState): void;
  update(deltaMs: number): void;
  dispose(): void;
}

/**
 * Nomi delle clip per stato, in ordine di preferenza.
 *
 * I GLB usano convenzioni diverse — `CharacterArmature|Idle` in mummy.glb,
 * `EnemyArmature|EnemyArmature|EnemyArmature|Idle` in royal_mummy.glb — quindi
 * il confronto avviene sull'ultimo segmento dopo `|`, senza distinzione di
 * maiuscole. Le varianti coprono le differenze di grafia fra i pack
 * (HitReact / HitRecieve, quest'ultimo con l'errore di battitura originale).
 */
const CLIP_CANDIDATES: Record<EnemyAnimState, readonly string[]> = {
  IDLE:   ['idle', 'jump_idle', 'zombie idle', 'mutant idle', 'standing idle', 'idle standing'],
  MOVE:   ['walk', 'run', 'run_arms', 'walking', 'running', 'zombie walk', 'walk forward', 'mummy walk'],
  ATTACK: ['attack', 'idle_attack', 'run_attack', 'punch', 'slash', 'zombie attack', 'standing melee attack', 'mummy attack'],
  HIT:    ['hitreact', 'hitrecieve', 'hitreceive', 'hit', 'hit react'],
  DEATH:  ['death', 'die', 'dying', 'death standing'],
};

/** Ultimo segmento del nome della clip, normalizzato. */
function clipKey(name: string): string {
  const parts = name.split('|');
  return (parts[parts.length - 1] ?? name).trim().toLowerCase();
}

/** Durata del crossfade fra stati, in secondi. */
const FADE_S = 0.18;

/**
 * Crea l'animator per un modello.
 *
 * @param root  - Il clone del GLB già in scena (il mixer agisce su questo).
 * @param clips - Le clip del GLB originale, da getArtifactClips().
 * @returns null se non c'è nessuna clip utilizzabile.
 */
export function createEnemyAnimator(
  root: THREE.Object3D,
  clips: readonly THREE.AnimationClip[],
): EnemyAnimator | null {
  if (clips.length === 0) return null;

  const mixer = new THREE.AnimationMixer(root);

  // Indice per chiave normalizzata: una sola passata su tutte le clip.
  const byKey = new Map<string, THREE.AnimationClip>();
  for (const clip of clips) {
    byKey.set(clipKey(clip.name), clip);
  }

  /** Prima clip disponibile fra i candidati dello stato. */
  const actionFor = (state: EnemyAnimState): THREE.AnimationAction | null => {
    for (const candidate of CLIP_CANDIDATES[state]) {
      const clip = byKey.get(candidate);
      if (clip) return mixer.clipAction(clip);
    }
    return null;
  };

  // Pre-risolve le azioni: evita lookup ripetuti a ogni cambio stato.
  const actions = new Map<EnemyAnimState, THREE.AnimationAction>();
  for (const state of ['IDLE', 'MOVE', 'ATTACK', 'HIT', 'DEATH'] as const) {
    const action = actionFor(state);
    if (action) actions.set(state, action);
  }

  // Senza almeno un idle non vale la pena tenere un mixer acceso.
  const idle = actions.get('IDLE');
  if (!idle) {
    mixer.stopAllAction();
    return null;
  }

  // Morte e colpo si riproducono una volta e restano sull'ultimo frame:
  // in loop il nemico morto continuerebbe a rialzarsi.
  for (const oneShot of ['DEATH', 'HIT'] as const) {
    const action = actions.get(oneShot);
    if (action) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
  }

  let current: EnemyAnimState = 'IDLE';
  idle.play();

  return {
    setState(next: EnemyAnimState): void {
      if (next === current) return;
      // La morte è terminale: nessuno stato successivo la interrompe.
      if (current === 'DEATH') return;

      const from = actions.get(current);
      const to = actions.get(next) ?? actions.get('IDLE');
      if (!to) return;

      // Le one-shot vanno riavviate da capo, altrimenti restano sul frame
      // finale dell'esecuzione precedente e non si vedrebbero.
      if (next === 'DEATH' || next === 'HIT') {
        to.reset();
      }
      to.play();
      if (from && from !== to) {
        to.crossFadeFrom(from, FADE_S, false);
      }
      current = next;
    },

    update(deltaMs: number): void {
      mixer.update(deltaMs / 1000);
    },

    dispose(): void {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  };
}
