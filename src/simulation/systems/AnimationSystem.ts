/**
 * G-24: sistema ECS che avanza i mixer tramite lo store.
 * Ownership: Simulation (fase `animation`). Il mixer Three.js vive nel
 *        renderer: qui si propaga solo lo stato logico.
 */

import type { System } from '@/core/SystemScheduler.js';
import type { World } from '@/ecs/World.js';
import { ANIM_STATE } from '@/ecs/components/AnimationStore.js';

export function createAnimationSystem(world: World): System {
  return {
    name: 'animation',
    phase: 'animation',
    update(_tick: number, _deltaMs: number): void {
      // Lo store è SoA: il renderer legge world.animation.getState(id)
      // e chiama mixer.update(delta) sul proprio EnemyAnimator.
      // Qui si garantisce che le entità morte restino su DEATH (terminale).
      const { animation, health } = world;
      for (let id = 1; id < animation.occupied.length; id++) {
        if (animation.occupied[id] !== 1) continue;
        if ((health.currentHp[id] ?? 1) <= 0) {
          animation.state[id] = ANIM_STATE.DEATH;
        }
      }
    },
  };
}
