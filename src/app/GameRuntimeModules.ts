export interface GameRuntimeModules {
  readonly gameApplication: Promise<typeof import('@/app/GameApplication.js')>;
  readonly floorGenerator: Promise<typeof import('@/procedural/FloorGenerator.js')>;
  readonly generationClient: Promise<typeof import('@/workers/GenerationClient.js')>;
  readonly physicsWorld: Promise<typeof import('@/physics/PhysicsWorld.js')>;
  readonly guardianRuntime: Promise<typeof import('@/gameplay/verticalSlice/SliceGuardianRuntime.js')>;
  readonly renderer: Promise<typeof import('@/rendering/ThreeRendererService.js')>;
  readonly dungeonLayout: Promise<typeof import('@/rendering/ThreeDungeonLayout.js')>;
  readonly playerRuntimeModules: Promise<[
    typeof import('@/gameplay/player/PlayerCharacterController.js'),
    typeof import('@/simulation/systems/PlayerSystem.js'),
    typeof import('@/simulation/systems/PhysicsSystem.js'),
  ]>;
}

let cachedRuntimeModules: GameRuntimeModules | null = null;

export function getGameRuntimeModules(): GameRuntimeModules {
  if (cachedRuntimeModules) {
    return cachedRuntimeModules;
  }

  cachedRuntimeModules = {
    gameApplication: import('@/app/GameApplication.js'),
    floorGenerator: import('@/procedural/FloorGenerator.js'),
    generationClient: import('@/workers/GenerationClient.js'),
    physicsWorld: import('@/physics/PhysicsWorld.js'),
    guardianRuntime: import('@/gameplay/verticalSlice/SliceGuardianRuntime.js'),
    renderer: import('@/rendering/ThreeRendererService.js'),
    dungeonLayout: import('@/rendering/ThreeDungeonLayout.js'),
    playerRuntimeModules: Promise.all([
      import('@/gameplay/player/PlayerCharacterController.js'),
      import('@/simulation/systems/PlayerSystem.js'),
      import('@/simulation/systems/PhysicsSystem.js'),
    ]),
  };

  return cachedRuntimeModules;
}
