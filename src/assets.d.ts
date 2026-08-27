/**
 * Dichiarazioni ambient per side-effect import di asset non-TypeScript
 * (CSS da fontsource). Con verbatimModuleSyntax TS non conosce i moduli
 * .css: questa dichiarazione li marca come side-effect import validi.
 */
declare module '*.css';

/**
 * Yuka 0.7.8 non pubblica .d.ts. Tipi minimi per steering AI (G-32).
 */
declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: { x: number; y: number; z: number }): this;
  }

  export class SteeringBehavior {
    weight: number;
  }

  export class SeekBehavior extends SteeringBehavior {
    constructor(target?: Vector3);
  }

  export class PursuitBehavior extends SteeringBehavior {
    constructor(evader?: GameEntity);
  }

  export class WanderBehavior extends SteeringBehavior {}

  export class FleeBehavior extends SteeringBehavior {
    constructor(target?: Vector3);
  }

  export class SteeringManager {
    add(behavior: SteeringBehavior): this;
    clear(): this;
  }

  export class GameEntity {
    position: Vector3;
  }

  export class Vehicle extends GameEntity {
    maxSpeed: number;
    maxForce: number;
    steering: SteeringManager;
  }

  export class EntityManager {
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    update(delta: number): this;
  }
}
