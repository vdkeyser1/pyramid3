/**
 * Scopo: inizializzazione asincrona del runtime Rapier3D (WASM).
 * Ownership: GameApplication chiama init() durante init().
 *
 * Rapier richiede `init()` prima di qualsiasi altra chiamata API.
 * Questo modulo garantisce che il WASM sia caricato una sola volta.
 */

import { createLogger, type Logger } from '@/core/Logger.js';

let initialized = false;
let initPromise: Promise<void> | null = null;
const log: Logger = createLogger('RapierRuntime');
const DEPRECATED_RAPIER_INIT_WARNING =
  'using deprecated parameters for the initialization function; pass a single object instead';

async function withSuppressedInitWarning<T>(task: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    if (args.length === 1 && args[0] === DEPRECATED_RAPIER_INIT_WARNING) {
      return;
    }
    originalWarn(...args);
  };

  try {
    return await task();
  } finally {
    console.warn = originalWarn;
  }
}

/**
 * Inizializza il WASM di Rapier3D-compat.
 * Idempotente: chiamate successive restituiscono la stessa promise.
 *
 * @throws Se il WASM non può essere caricato.
 */
export async function initRapier(): Promise<void> {
  if (initialized) return;

  if (initPromise !== null) {
    return initPromise;
  }

  initPromise = (async (): Promise<void> => {
    try {
      // Dynamic import per evitare di tirare dentro Rapier nel bundle
      // prima che serva (tree-shaking friendly). Il package compat 0.19.3
      // inizializza internamente il WASM con una firma deprecata e rumorosa.
      const RAPIER = await import('@dimforge/rapier3d-compat');
      await withSuppressedInitWarning(() => RAPIER.init());
      initialized = true;
      log.info('Rapier3D WASM inizializzato');
    } catch (err) {
      initPromise = null;
      log.error('Rapier3D WASM init fallito', { error: String(err) });
      throw new Error('Rapier3D init failed', { cause: err });
    }
  })();

  return initPromise;
}

/** Restituisce true se Rapier è già inizializzato. */
export function isRapierReady(): boolean {
  return initialized;
}
