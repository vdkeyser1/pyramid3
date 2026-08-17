/**
 * Scopo: factory function che crea e inizializza il GameApplication.
 * Ownership: main.ts.
 */

import type { GameApplication } from '@/app/GameApplication.js';
import { DEFAULT_CONFIG } from '@/config/GameConfig.js';
import { getGameRuntimeModules } from '@/app/GameRuntimeModules.js';
import { createLogger } from '@/core/Logger.js';
import { preloadStartupModules } from '@/app/StartupPreload.js';

const log = createLogger('Bootstrap');

/**
 * Legge ?seed=N dall'URL. Ritorna il numero se è un intero valido, altrimenti
 * null (nessun seed forzato). Supporta anche debug.fixedSeed via ?fixedSeed=.
 */
export function parseSeedParam(search: string): number | null {
  const params = new URLSearchParams(search);
  const raw = params.get('seed') ?? params.get('fixedSeed');
  if (raw === null) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * DAILY-1: "Tomba del Giorno" — seed deterministico dalla data (YYYY-MM-DD).
 * Stesso seed per tutti i giocatori ogni 24h, zero server. FNV-1a 32-bit
 * sulla stringa della data: stabile, riproducibile, nessun Math.random.
 */
export function dailySeedFor(date: Date): number {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const key = `${y}-${m}-${d}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** DAILY-1: true se ?daily è presente nell'URL (Tomba del Giorno). */
export function isDailyMode(search: string): boolean {
  return new URLSearchParams(search).get('daily') !== null;
}

export interface CreateGameOptions {
  readonly canvasId?: string;
  readonly onStatus?: (status: string) => void;
}

export async function createGame(options: CreateGameOptions = {}): Promise<GameApplication> {
  const { canvasId, onStatus } = options;
  const canvas = document.getElementById(canvasId ?? 'game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Canvas #game-canvas non trovato nel DOM');
  }

  void preloadStartupModules();
  onStatus?.('Caricamento modulo gioco...');
  const { createGameApplication } = await getGameRuntimeModules().gameApplication;
  // G-22: supporto ?seed=N nell'URL → run riproducibile (debug, test e2e).
  // DAILY-1: ?daily → "Tomba del Giorno" — stesso seed per tutti ogni 24h.
  const search = window.location.search;
  const urlSeed = parseSeedParam(search);
  const dailySeed = isDailyMode(search) ? dailySeedFor(new Date()) : null;
  const fixedSeed = urlSeed ?? dailySeed;
  const app = createGameApplication(
    fixedSeed === null
      ? undefined
      : { debug: { ...DEFAULT_CONFIG.debug, fixedSeed } },
    onStatus,
  );
  if (dailySeed !== null && urlSeed === null) {
    log.info('Tomba del Giorno attiva', { seed: dailySeed });
  }

  // Prepara il canvas
  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;

  onStatus?.('Inizializzazione scena...');
  await app.init(canvas);
  onStatus?.('Avvio loop di gioco...');
  app.start();

  // Gestione visibilità
  const onVisibility = (): void => {
    if (document.hidden) {
      app.pause('visibility');
    } else if (app.state === 'paused') {
      app.resume('visibility');
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const disposeBase = app.dispose.bind(app);
  app.dispose = (): void => {
    document.removeEventListener('visibilitychange', onVisibility);
    disposeBase();
  };

  log.info('Gioco creato e avviato');
  return app;
}
