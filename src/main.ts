/**
 * Punto di ingresso dell'applicazione.
 * Carica stili, crea il gioco, gestisce errori globali.
 *
 * Comando: npm run dev
 * Build:   npm run build
 */

import { configureLogger } from '@/core/Logger.js';
import { preloadStartupModules } from '@/app/StartupPreload.js';

// FONT-1: identità typographic Egyptian Noir — Cinzel per i titoli
// (epigrafe romano-egiziana) + geroglifici Noto per decorazioni autentiche.
// Self-hosted via fontsource (nessuna CDN esterna, offline-ready).
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/noto-sans-egyptian-hieroglyphs/400.css';

// Applica Cinzel come font di default dell'interfaccia
const style = document.createElement('style');
style.textContent = `
  :root {
    --font-title: 'Cinzel', Georgia, 'Times New Roman', serif;
    --font-hieroglyph: 'Noto Sans Egyptian Hieroglyphs', 'Cinzel', serif;
  }
  body, #app, #game-hud, #main-menu, #settings-menu, #game-tutorial,
  #death-overlay, #progression-overlay {
    font-family: var(--font-title);
  }
  .hieroglyph { font-family: var(--font-hieroglyph); }
`;
document.head.appendChild(style);

// Configurazione logger precoce per catturare errori di bootstrap
configureLogger('INFO');

const appElement = document.querySelector<HTMLDivElement>('#app');
if (!appElement) {
  throw new Error('Elemento #app non trovato');
}

// Assicura che #app sia un contenitore posizionato
appElement.style.position = 'relative';

// Canvas a tutto schermo (sotto la loading screen)
const canvas = document.createElement('canvas');
canvas.id = 'game-canvas';
canvas.tabIndex = 0;
canvas.setAttribute('aria-label', 'Canvas di gioco La Piramide Perduta');
canvas.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: block;';
appElement.appendChild(canvas);

// Schermata di loading (sopra il canvas)
const loadingScreen = document.createElement('div');
loadingScreen.id = 'loading-screen';
loadingScreen.style.cssText = `
  position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: #0B0908; color: #D4A05A; font-family: monospace;
`;
loadingScreen.innerHTML = `
  <h1 style="font-size: 2rem; margin-bottom: 0.5rem;">LA PIRAMIDE PERDUTA</h1>
  <p style="color: #2E8B8B; margin-bottom: 2rem;">Egyptian Noir Roguelike FPS</p>
  <p id="loading-status" style="color: #9A5A38;">Inizializzazione...</p>
`;
appElement.appendChild(loadingScreen);

const statusEl = document.getElementById('loading-status');

try {
  if (statusEl) statusEl.textContent = 'Caricamento bootstrap...';
  void preloadStartupModules();
  const { createGame } = await import('@/app/createGame.js');
  const app = await createGame({
    canvasId: 'game-canvas',
    onStatus: (status: string) => {
      if (statusEl) statusEl.textContent = status;
    },
  });

  // Nascondi schermata di loading
  loadingScreen.style.display = 'none';

  // Cleanup alla chiusura
  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
} catch (err) {
  console.error('Errore fatale di bootstrap:', err);
  if (statusEl) {
    statusEl.textContent = `Errore: ${err instanceof Error ? err.message : String(err)}`;
    statusEl.style.color = '#6A334D';
  }
}
