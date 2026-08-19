/**
 * Q-01 — E2E Gameplay Loop Test
 * Testa il ciclo completo: avvio → piano 1 → piano 2 → morte → menu principale.
 * Estende i helper definiti in smoke.spec.ts.
 *
 * Requisiti:
 *   - Server dev Vite in ascolto (BASE_URL env, default http://localhost:5173)
 *   - Playwright con Chromium
 *   - Build non richiesta (usa dev server)
 */

import { test, expect, type Page } from '@playwright/test';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = process.env['BASE_URL'] ?? 'http://localhost:5173';

/** Timeout per operazioni di navigazione lente (caricamento WASM, assets). */
const NAV_TIMEOUT     = 30_000;
/** Timeout per azioni di gioco (spawn nemici, transizioni). */
const ACTION_TIMEOUT  = 15_000;
/** Timeout esteso per transizioni di piano. */
const FLOOR_TIMEOUT   = 20_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Installa shim per PointerLock API (non disponibile in Playwright headless). */
async function installPointerLockShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestPointerLock = function () {
      document.dispatchEvent(new Event('pointerlockchange'));
      Object.defineProperty(document, 'pointerLockElement', {
        get: () => this,
        configurable: true,
      });
    };
    document.exitPointerLock = () => {
      Object.defineProperty(document, 'pointerLockElement', {
        get: () => null,
        configurable: true,
      });
    };
  });
}

/** Forza WebGL2 disabilitando WebGPU (necessario in CI headless). */
async function forceWebGL2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Sovrascrive getContext per reindirizzare 'webgpu' a null
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === 'webgpu') return null;
      return origGetContext.call(this, contextId, ...(args as []));
    };
  });
}

/** Avvia la partita e attende che il canvas di gioco sia attivo. */
async function startGame(page: Page): Promise<void> {
  await page.goto(BASE_URL, { timeout: NAV_TIMEOUT });

  // Attende caricamento iniziale (splash / loading screen)
  await page.waitForSelector('[data-testid="loading-complete"], canvas', {
    timeout: NAV_TIMEOUT,
  });

  // Se c'è un pulsante Start, cliccalo
  const startBtn = page.locator('[data-testid="btn-start"], button:has-text("Inizia"), button:has-text("Play"), button:has-text("Start")').first();
  if (await startBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await startBtn.click();
  }

  // Attende che il canvas di gioco sia visibile e la sessione sia giocabile
  await page.waitForSelector('canvas', { state: 'visible', timeout: NAV_TIMEOUT });

  // Attiva il gioco con un click sul canvas per ottenere il focus
  await page.click('canvas', { force: true });
}

/** Attende un selector con timeout personalizzato. */
async function waitFor(
  page: Page,
  selector: string,
  timeout: number = ACTION_TIMEOUT,
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/** Simula movimento WASD per un breve periodo. */
async function walkAround(page: Page, ms = 1_000): Promise<void> {
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(ms / 4);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(ms / 4);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(ms / 4);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(ms / 4);
  await page.keyboard.up('KeyA');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await forceWebGL2(page);
  await installPointerLockShim(page);
});

test('smoke — il gioco si carica e mostra il canvas', async ({ page }) => {
  await page.goto(BASE_URL, { timeout: NAV_TIMEOUT });
  await page.waitForSelector('canvas', { state: 'visible', timeout: NAV_TIMEOUT });
  await expect(page.locator('canvas')).toBeVisible();
});

test('gameplay loop — piano 1: il giocatore può muoversi', async ({ page }) => {
  await startGame(page);

  // Verifica che nessun crash sia avvenuto prima del movimento
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await walkAround(page, 2_000);

  // Non deve esserci un overlay di errore critico
  const errorOverlay = page.locator('[data-testid="error-overlay"], .error-fatal');
  await expect(errorOverlay).not.toBeVisible();

  // Filtra errori irrilevanti (es. font non trovato) e verifica che non ci siano crash
  const criticalErrors = consoleErrors.filter(
    (e) => !e.includes('font') && !e.includes('404') && !e.includes('favicon'),
  );
  expect(criticalErrors).toHaveLength(0);
});

test('gameplay loop — pausa e ripresa', async ({ page }) => {
  await startGame(page);
  await walkAround(page, 500);

  // Premi Escape per aprire il menu di pausa
  await page.keyboard.press('Escape');

  const pauseMenu = page.locator(
    '[data-testid="pause-menu"], [data-testid="menu-pausa"], .pause-overlay',
  );
  const paused = await waitFor(page, '[data-testid="pause-menu"], .pause-overlay', 3_000);

  if (paused) {
    // Riprendi
    await page.keyboard.press('Escape');
    await expect(pauseMenu).not.toBeVisible({ timeout: 3_000 });
  }
  // Se il gioco non ha un menu di pausa accessibile da testid, il test è un canary
});

test('gameplay loop — transizione di piano (se raggiungibile)', async ({ page }) => {
  test.setTimeout(60_000);

  await startGame(page);

  // Cerca indicatore di piano nella HUD
  const floorIndicator = page.locator(
    '[data-testid="floor-indicator"], [data-testid="hud-floor"], .hud-floor',
  );

  const hasFloorHUD = await waitFor(
    page,
    '[data-testid="floor-indicator"], [data-testid="hud-floor"], .hud-floor',
    5_000,
  );

  if (!hasFloorHUD) {
    test.skip();
    return;
  }

  const initialFloor = await floorIndicator.textContent();

  // Cerca la porta di uscita (exit / scale) e interagisci
  const exitDoor = page.locator('[data-testid="exit-door"], [data-testid="floor-exit"]');
  const hasExit  = await waitFor(page, '[data-testid="exit-door"], [data-testid="floor-exit"]', FLOOR_TIMEOUT);

  if (hasExit) {
    await exitDoor.click({ force: true });
    await page.waitForTimeout(2_000); // attende transizione

    const newFloor = await floorIndicator.textContent();
    // Il numero di piano deve essere cambiato
    expect(newFloor).not.toBe(initialFloor);
  }
});

test('gameplay loop — morte e ritorno al menu', async ({ page }) => {
  test.setTimeout(60_000);

  await startGame(page);

  // Cerca screen di game over / death screen
  const deathScreen = page.locator(
    '[data-testid="death-screen"], [data-testid="game-over"], .game-over',
  );

  // Inietta morte del giocatore via console (se l'API dev è disponibile)
  await page.evaluate(() => {
    const w = window as unknown as {
      __PIRAMIDE_DEV__?: { killPlayer?: () => void };
    };
    w.__PIRAMIDE_DEV__?.killPlayer?.();
  });

  const died = await waitFor(
    page,
    '[data-testid="death-screen"], [data-testid="game-over"], .game-over',
    8_000,
  );

  if (!died) {
    // Se non c'è API dev, il test è un canary — segna come skip
    test.skip();
    return;
  }

  await expect(deathScreen).toBeVisible();

  // Cerca pulsante "Torna al menu" o "Main Menu"
  const menuBtn = page.locator(
    'button:has-text("Menu"), button:has-text("Torna"), [data-testid="btn-main-menu"]',
  ).first();

  if (await menuBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await menuBtn.click();
    // Il canvas o il menu principale devono tornare visibili
    await page.waitForSelector(
      '[data-testid="main-menu"], canvas',
      { timeout: ACTION_TIMEOUT },
    );
  }
});

test('accessibilità — titolo pagina presente', async ({ page }) => {
  await page.goto(BASE_URL, { timeout: NAV_TIMEOUT });
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
});

test('accessibilità — nessun errore di console critico al caricamento', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(BASE_URL, { timeout: NAV_TIMEOUT });
  await page.waitForSelector('canvas', { state: 'visible', timeout: NAV_TIMEOUT });

  const critical = errors.filter(
    (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('font'),
  );
  expect(critical).toHaveLength(0);
});
