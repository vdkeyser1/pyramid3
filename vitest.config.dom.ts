import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Progetto di test per la UI DOM (HUD, SettingsMenu, MainMenu, overlay)
 * e per i moduli che richiedono localStorage / AudioContext mock.
 *
 * Ambiente happy-dom (più leggero di jsdom, sufficiente per DOM sintetico).
 * Separato dal progetto node principale: i test di logica pura restano su
 * environment "node" senza penalità (G-20).
 *
 * Include anche:
 *   - MetaProgressionStore (localStorage fallback)
 *   - GameAnalytics (localStorage)
 *   - DailyChallengeSystem (localStorage)
 *   - SyntheticImpulseResponse (AudioContext mock via happy-dom)
 *   - InstancedDungeonRenderer helpers (pura logica, no WebGL)
 */
export default defineConfig({
  test: {
    name: 'dom',
    environment: 'happy-dom',
    include: [
      // Test UI DOM originali
      'tests/dom/**/*.test.ts',
      // Nuovi moduli con localStorage / AudioContext
      'tests/meta/**/*.test.ts',
      'tests/analytics/**/*.test.ts',
      'tests/rendering/InstancedDungeonRenderer.test.ts',
      'tests/audio/SyntheticImpulseResponse.test.ts',
      'tests/gameplay/DailyChallengeSystem.test.ts',
      // Test che richiedono navigator/matchMedia
      'tests/input/GamepadAdapter.test.ts',
      'tests/platform/ReducedMotionAdapter.test.ts',
      // Wildcard per test DOM futuri
      'tests/**/*.dom.test.ts',
    ],
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
