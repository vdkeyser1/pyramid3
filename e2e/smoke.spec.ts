import { expect, test, type Page } from '@playwright/test';

/** Blocca WebGPU: il gioco deve degradare a WebGL2 (con bloom) senza crash. */
async function forceWebGL2(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'gpu', {
      configurable: true,
      get: () => undefined,
    });
  });
}

async function installPointerLockShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let pointerLockTarget: Element | null = null;
    const dispatchPointerLockChange = (): void => {
      document.dispatchEvent(new Event('pointerlockchange'));
    };

    Object.defineProperty(Document.prototype, 'pointerLockElement', {
      configurable: true,
      get() {
        return pointerLockTarget;
      },
    });

    Object.defineProperty(HTMLElement.prototype, 'requestPointerLock', {
      configurable: true,
      value: function requestPointerLock(this: HTMLElement): void {
        pointerLockTarget = this;
        dispatchPointerLockChange();
      },
    });

    Object.defineProperty(Document.prototype, 'exitPointerLock', {
      configurable: true,
      value: function exitPointerLock(): void {
        pointerLockTarget = null;
        dispatchPointerLockChange();
      },
    });
  });
}

async function expectCanvasFocus(page: Page): Promise<void> {
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.id))
    .toBe('game-canvas');
}

async function expectPointerLockState(page: Page, state: 'locked' | 'pending' | 'unlocked'): Promise<void> {
  await expect
    .poll(async () => page.locator('#game-canvas').getAttribute('data-pointer-lock'))
    .toBe(state);
}

async function startPlayableSession(page: Page): Promise<void> {
  await installPointerLockShim(page);
  await page.goto('/');
  await expect(page.locator('#loading-screen')).toBeHidden();
  // G-09 + G-18 V3: menu → INIZIA → intro cinematografica con la torcia da
  // raccogliere; il tutorial appare DOPO la raccolta (E).
  await expect(page.locator('#main-menu')).toBeVisible();
  await page.getByRole('button', { name: /INIZIA LA DISCESA/i }).click();
  await expect(page.locator('#main-menu')).toBeHidden();
  await expect(page.locator('#game-tutorial')).toBeHidden();
  await page.keyboard.press('KeyE');
  await expect(page.locator('#game-tutorial')).toBeVisible();
  await page.locator('#tutorial-dismiss').click();
  await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas') as HTMLElement | null;
    canvas?.requestPointerLock();
  });
  await expectPointerLockState(page, 'locked');
  await expectCanvasFocus(page);
}

test('menu principale: mostra progressione, apre impostazioni e avvia la discesa', async ({ page }) => {
  await installPointerLockShim(page);
  await page.goto('/');

  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#main-menu')).toBeVisible();
  await expect(page.locator('#main-menu [role="dialog"]')).toHaveCount(1);
  await expect(page.locator('#main-menu [aria-modal="true"]')).toHaveCount(1);

  // Le impostazioni si aprono dal menu senza far partire il loop.
  await page.getByRole('button', { name: /Impostazioni di accessibilita/i }).click();
  await expect(page.locator('#settings-menu')).toBeVisible();
  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.locator('#settings-menu')).toBeHidden();
  await expect(page.locator('#main-menu')).toBeVisible();

  // G-18 V3: dopo INIZIA parte l'intro con la torcia da raccogliere — il
  // tutorial appare SOLO dopo la raccolta (E), non subito (G-09 aggiornato).
  await expect(page.locator('#game-tutorial')).toBeHidden();
  await page.getByRole('button', { name: /INIZIA LA DISCESA/i }).click();
  await expect(page.locator('#main-menu')).toBeHidden();
  await expect(page.locator('#game-tutorial')).toBeHidden();
  // Aspetta l'intro attiva (messaggio della torcia) prima di premere E:
  // l'init è asincrono (font, SSAO, quality) — KeyE troppo presto va perso.
  await expect(page.getByText(/Raccogli la torcia/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#game-tutorial')).toBeVisible();
  await expect(page.locator('#tutorial-dismiss')).toHaveText(/INIZIA LA PARTITA/i);
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.id))
    .toBe('tutorial-dismiss');

  await page.keyboard.press('Tab');
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.id))
    .toBe('tutorial-dismiss');

  await page.keyboard.press('Shift+Tab');
  await expect
    .poll(async () => page.evaluate(() => document.activeElement?.id))
    .toBe('tutorial-dismiss');

  await page.keyboard.press('Escape');

  await expect(page.locator('#game-tutorial')).toBeHidden();
  await expect(page.locator('#settings-menu')).toBeHidden();
  await expectPointerLockState(page, 'locked');
  await expectCanvasFocus(page);
});

test('bootstrap della pagina principale', async ({ page }) => {
  await startPlayableSession(page);

  await expect(page).toHaveTitle(/LA PIRAMIDE PERDUTA/i);
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#game-canvas')).toHaveCount(1);
  await expect(page.locator('#game-canvas')).toHaveAttribute('aria-label', /Canvas di gioco/i);

  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-menu')).toBeVisible();

  await page.getByRole('button', { name: 'Annulla' }).click();
  await expect(page.locator('#settings-menu')).toBeHidden();
  await expectPointerLockState(page, 'locked');
  await expectCanvasFocus(page);

  const initialCanvasMetrics = await page.locator('#game-canvas').evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
  }));

  await page.locator('#game-canvas').evaluate((canvas: HTMLCanvasElement) => {
    canvas.style.width = '640px';
    canvas.style.height = '360px';
  });

  await expect.poll(async () => page.locator('#game-canvas').evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
  }))).not.toEqual(initialCanvasMetrics);
});

test('visibility pause/resume riaggancia input e focus canvas', async ({ page }) => {
  await startPlayableSession(page);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expectPointerLockState(page, 'pending');

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expectCanvasFocus(page);
  await expectPointerLockState(page, 'pending');

  await page.locator('#game-canvas').click({ position: { x: 32, y: 32 } });
  await expectPointerLockState(page, 'locked');

  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-menu')).toBeVisible();
});

test('pointer-lock recovery passa da locked a pending e poi torna locked', async ({ page }) => {
  await startPlayableSession(page);

  await page.evaluate(() => {
    document.exitPointerLock();
  });

  await expect(page.locator('#game-canvas')).toHaveAttribute('data-pointer-lock', 'pending');

  await page.locator('#game-canvas').click({ position: { x: 40, y: 40 } });

  await expectPointerLockState(page, 'locked');
});

test('pointer lock recovery resta ripetibile dopo sgancio runtime', async ({ page }) => {
  await startPlayableSession(page);

  await page.evaluate(() => {
    document.exitPointerLock();
  });

  await expectCanvasFocus(page);
  await expectPointerLockState(page, 'pending');

  await page.locator('#game-canvas').click({ position: { x: 48, y: 48 } });
  await expectPointerLockState(page, 'locked');

  await page.evaluate(() => {
    document.exitPointerLock();
  });

  await expectCanvasFocus(page);
  await expectPointerLockState(page, 'pending');

  await page.locator('#game-canvas').click({ position: { x: 64, y: 64 } });
  await expectPointerLockState(page, 'locked');

  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-menu')).toBeVisible();
});

test('le impostazioni runtime persistono dopo reload', async ({ page }) => {
  await startPlayableSession(page);

  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-menu')).toBeVisible();

  const highContrastToggle = page.locator('#settings-menu [name="highContrast"]');
  await highContrastToggle.check();
  await page.getByRole('button', { name: 'Applica' }).click();

  await expect(page.locator('#settings-menu')).toBeHidden();
  await expect
    .poll(async () => page.locator('#game-hud').evaluate((el) => getComputedStyle(el).color))
    .toBe('rgb(247, 230, 182)');

  await page.reload();
  await expect(page.locator('#loading-screen')).toBeHidden();
  // Dopo il reload si torna al menu principale, ma la palette persiste.
  await expect(page.locator('#main-menu')).toBeVisible();
  await expect
    .poll(async () => page.locator('#game-hud').evaluate((el) => getComputedStyle(el).color))
    .toBe('rgb(247, 230, 182)');

  await page.getByRole('button', { name: /INIZIA LA DISCESA/i }).click();
  // G-18 V3: raccogli la torcia (E) → tutorial
  await page.keyboard.press('KeyE');
  await expect(page.locator('#game-tutorial')).toBeVisible();
  await page.locator('#tutorial-dismiss').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-menu')).toBeVisible();
  await expect(highContrastToggle).toBeChecked();
});

test('colorBlindMode aggiorna la palette HUD in tempo reale', async ({ page }) => {
  await startPlayableSession(page);

  await expect
    .poll(async () => page.locator('#game-hud').evaluate((el) => getComputedStyle(el).color))
    .toBe('rgb(212, 160, 90)');

  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-menu')).toBeVisible();

  await page.selectOption('#settings-menu [name="colorBlindMode"]', 'tritanopia');
  await page.getByRole('button', { name: 'Applica' }).click();

  await expect(page.locator('#settings-menu')).toBeHidden();
  await expect
    .poll(async () => page.locator('#game-hud').evaluate((el) => getComputedStyle(el).color))
    .toBe('rgb(231, 192, 200)');
});

test('la progressione del profilo alimenta il menu principale (Frammenti)', async ({ page }) => {
  await installPointerLockShim(page);

  // Profilo con 12 Frammenti e 1 bestiario pre-popolato via IndexedDB.
  await page.goto('/');
  await page.evaluate(async () => {
    const request = indexedDB.open('la-piramide-perduta', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('profile', { keyPath: 'id' });
    };
    await new Promise<void>((resolve) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('profile', 'readwrite');
        tx.objectStore('profile').put({
          id: 'current',
          schemaVersion: 1,
          contentVersion: '0.1.0',
          createdAt: '2026-08-13T00:00:00.000Z',
          updatedAt: '2026-08-13T00:00:00.000Z',
          checksum: 'test',
          payload: {
            fragments: 12,
            pyramidsUnlocked: 1,
            bestiaryEntries: ['SCARAB'],
            discoveredGrafts: [],
            kaNodes: [],
            claimedTreasureSiteIds: [],
            completedFloorIds: [],
            settings: {},
          },
        });
        tx.oncomplete = () => resolve();
      };
    });
  });

  await page.reload();
  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#main-menu')).toBeVisible();
  await expect(page.locator('#main-menu')).toContainText('Frammenti di Ka: 12');
  await expect(page.locator('#main-menu')).toContainText(/Bestiario: 1 voci/i);
});

test('fallback WebGL2: il gioco parte senza WebGPU (bloom attivo, nessun crash)', async ({ page }) => {
  await forceWebGL2(page);
  await installPointerLockShim(page);
  await page.goto('/');

  await expect(page.locator('#loading-screen')).toBeHidden();
  await expect(page.locator('#main-menu')).toBeVisible();

  // Il gioco deve avere scelto WebGL2 e aver creato il canvas
  await expect(page.locator('#game-canvas')).toBeVisible();
  await expect(page.locator('#game-canvas')).not.toHaveJSProperty('width', 0);

  // Avvia la discesa → intro con torcia → raccogli (E) → il gioco gira
  await page.locator('#main-menu').getByRole('button', { name: /inizia la discesa/i }).click();
  await expect(page.getByText(/Raccogli la torcia/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#game-tutorial')).toBeVisible({ timeout: 5000 });
});

/** Estrae la fingerprint della minimappa: coordinate SVG di tutte le stanze. */
async function readMinimapFingerprint(page: Page): Promise<string> {
  await page.waitForSelector('#game-hud svg', { timeout: 8000 });
  return page.evaluate(() => {
    const svg = document.querySelector('#game-hud svg');
    if (!svg) return 'no-svg';
    const rects = [...svg.querySelectorAll('rect')].map((rect) => {
      const x = rect.getAttribute('x') ?? '';
      const y = rect.getAttribute('y') ?? '';
      const w = rect.getAttribute('width') ?? '';
      const h = rect.getAttribute('height') ?? '';
      return `${x},${y},${w},${h}`;
    });
    return rects.join('|');
  });
}

async function startRunAndDismissTutorial(page: Page, seedParam = '?seed=42'): Promise<void> {
  await installPointerLockShim(page);
  await page.goto(`/${seedParam}`);
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.locator('#main-menu').getByRole('button', { name: /inizia la discesa/i }).click();
  // G-18 V3: raccogli la torcia introduttiva (E) → tutorial. L'init è
  // asincrono (font, SSAO, quality): aspetta l'intro prima di premere E.
  await expect(page.getByText(/Raccogli la torcia/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#game-tutorial')).toBeVisible({ timeout: 5000 });
  await page.locator('#game-tutorial button').click();
  await expect(page.locator('#game-hud svg')).toBeVisible({ timeout: 8000 });
}

// I test di seed condividono l'origin (IndexedDB del profilo): girano in
// serie per evitare race sul profilo condiviso tra test paralleli.
test.describe.configure({ mode: 'serial' });

test('riproducibilità del seed: ?seed=42 genera la stessa minimappa in run diverse', async ({ page }) => {
  await startRunAndDismissTutorial(page);
  const first = await readMinimapFingerprint(page);
  expect(first).not.toBe('no-svg');
  expect(first.split('|').length).toBeGreaterThan(1);

  await page.reload();
  await expect(page.locator('#loading-screen')).toBeHidden();
  await page.locator('#main-menu').getByRole('button', { name: /inizia la discesa/i }).click();
  await expect(page.getByText(/Raccogli la torcia/)).toBeVisible({ timeout: 8000 });
  await page.keyboard.press('KeyE');
  await expect(page.locator('#game-tutorial')).toBeVisible({ timeout: 5000 });
  await page.locator('#game-tutorial button').click();
  await expect(page.locator('#game-hud svg')).toBeVisible({ timeout: 8000 });

  const second = await readMinimapFingerprint(page);
  expect(second).toBe(first);
});

test('varianza del seed: seed diversi generano minimappe diverse', async ({ page }) => {
  await startRunAndDismissTutorial(page, '?seed=42');
  const seed42 = await readMinimapFingerprint(page);

  await startRunAndDismissTutorial(page, '?seed=777');
  const seed777 = await readMinimapFingerprint(page);

  // Layout diversi: fingerprint differenti (probabilità di collisione ~0)
  expect(seed42).not.toBe(seed777);
});
