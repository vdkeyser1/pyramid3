/**
 * Scopo: anticipare il fetch dei moduli pesanti gia' necessari al primo avvio.
 * Ownership: bootstrap UI (`main.ts`) e factory (`createGame.ts`).
 *
 * Il preload e' best-effort: non deve bloccare il bootstrap ne' renderlo fragile.
 */

import { getGameRuntimeModules } from '@/app/GameRuntimeModules.js';

let startupPreloadPromise: Promise<void> | null = null;

function settleImports(imports: readonly Promise<unknown>[]): Promise<void> {
  return Promise.allSettled(imports).then(() => undefined);
}

export function preloadStartupModules(): Promise<void> {
  if (startupPreloadPromise) {
    return startupPreloadPromise;
  }

  const runtimeModules = getGameRuntimeModules();
  startupPreloadPromise = settleImports([
    runtimeModules.gameApplication,
    runtimeModules.floorGenerator,
    runtimeModules.generationClient,
    runtimeModules.physicsWorld,
    runtimeModules.guardianRuntime,
    runtimeModules.renderer,
    runtimeModules.dungeonLayout,
    runtimeModules.playerRuntimeModules,
  ]);

  return startupPreloadPromise;
}
