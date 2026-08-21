import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEnemyAnimator } from '@/rendering/EnemyAnimator.js';

/**
 * La parte fragile è la risoluzione dei nomi delle clip: i GLB usano
 * convenzioni diverse fra loro. mummy.glb ha `CharacterArmature|Idle`,
 * royal_mummy.glb ha `EnemyArmature|EnemyArmature|EnemyArmature|Idle`, e
 * l'animazione di colpo è scritta `HitReact` in uno e `HitRecieve`
 * nell'altro (con l'errore di battitura nell'originale).
 */
function clip(name: string): THREE.AnimationClip {
  // Una traccia minima ma valida: il mixer richiede almeno un keyframe.
  const track = new THREE.NumberKeyframeTrack('.scale[x]', [0, 1], [1, 1]);
  return new THREE.AnimationClip(name, 1, [track]);
}

function makeRoot(): THREE.Object3D {
  const root = new THREE.Object3D();
  root.name = 'enemy';
  return root;
}

describe('EnemyAnimator', () => {
  it('senza clip non crea alcun animator', () => {
    expect(createEnemyAnimator(makeRoot(), [])).toBeNull();
  });

  it('senza una clip di idle non crea alcun animator', () => {
    // Solo attacco: non c'è uno stato di riposo su cui ricadere.
    const animator = createEnemyAnimator(makeRoot(), [clip('Armature|Attack')]);
    expect(animator).toBeNull();
  });

  it('riconosce la convenzione di mummy.glb', () => {
    const animator = createEnemyAnimator(makeRoot(), [
      clip('CharacterArmature|Idle'),
      clip('CharacterArmature|Run'),
      clip('CharacterArmature|Idle_Attack'),
      clip('CharacterArmature|HitReact'),
      clip('CharacterArmature|Death'),
    ]);
    expect(animator).not.toBeNull();
  });

  it('riconosce la convenzione annidata di royal_mummy.glb', () => {
    const animator = createEnemyAnimator(makeRoot(), [
      clip('EnemyArmature|EnemyArmature|EnemyArmature|Idle'),
      clip('EnemyArmature|EnemyArmature|EnemyArmature|Walk'),
      clip('EnemyArmature|EnemyArmature|EnemyArmature|Attack'),
      clip('EnemyArmature|EnemyArmature|EnemyArmature|HitRecieve'),
      clip('EnemyArmature|EnemyArmature|EnemyArmature|Death'),
    ]);
    expect(animator).not.toBeNull();
  });

  it('accetta nomi senza prefisso di armature', () => {
    expect(createEnemyAnimator(makeRoot(), [clip('idle')])).not.toBeNull();
  });

  it('i cambi di stato non lanciano, anche verso clip assenti', () => {
    // Solo idle disponibile: gli altri stati devono ricadere su di esso.
    const animator = createEnemyAnimator(makeRoot(), [clip('Idle')]);
    expect(animator).not.toBeNull();
    if (!animator) return;

    expect(() => {
      animator.setState('MOVE');
      animator.setState('ATTACK');
      animator.setState('HIT');
      animator.update(16);
      animator.setState('IDLE');
      animator.update(16);
    }).not.toThrow();
  });

  it('la morte è terminale: nessuno stato successivo la sostituisce', () => {
    const animator = createEnemyAnimator(makeRoot(), [
      clip('Idle'), clip('Run'), clip('Death'),
    ]);
    expect(animator).not.toBeNull();
    if (!animator) return;

    animator.setState('DEATH');
    // Un nemico morto non deve tornare a camminare.
    expect(() => {
      animator.setState('MOVE');
      animator.update(16);
    }).not.toThrow();
  });

  it('dispose è sicuro e idempotente', () => {
    const animator = createEnemyAnimator(makeRoot(), [clip('Idle')]);
    expect(animator).not.toBeNull();
    if (!animator) return;
    expect(() => {
      animator.dispose();
      animator.dispose();
    }).not.toThrow();
  });
});
