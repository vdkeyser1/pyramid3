import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Progetto di test per la UI DOM (HUD, SettingsMenu, MainMenu, overlay).
 * Ambiente happy-dom (più leggero di jsdom, sufficiente per DOM sintetico).
 * Separato dal progetto node principale: i test di logica pura restano su
 * environment "node" senza penalità (G-20).
 */
export default defineConfig({
  test: {
    name: 'dom',
    environment: 'happy-dom',
    include: ['tests/dom/**/*.test.ts'],
    pool: 'threads',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
