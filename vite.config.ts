import { defineConfig } from "vite";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  plugins: [
    // PWA-1: installabile + offline — manifest e service worker generati
    // automaticamente (CacheFirst sugli asset statici, Workbox).
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "La Piramide Perduta",
        short_name: "Piramide",
        description: "Egyptian Noir Roguelike FPS — browser-first",
        theme_color: "#0B0908",
        background_color: "#0B0908",
        display: "standalone",
        orientation: "landscape",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,glb,jpg,png,woff2,ktx2,hdr}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // daily-seed.json: NetworkFirst con 25h di stale-while-revalidate
        runtimeCaching: [
          {
            urlPattern: /\/daily-seed\.json$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "daily-seed-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxAgeSeconds: 90000 }, // 25h
            },
          },
          {
            urlPattern: /\.ktx2$/,
            handler: "CacheFirst",
            options: {
              cacheName: "ktx2-textures",
              expiration: { maxEntries: 64, maxAgeSeconds: 31536000 }, // 1 anno
            },
          },
        ],
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: process.env.VITE_SOURCEMAP === "true",
    // B-01: mai inline WASM — Rapier necessita fetch separato
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // B-01: chunk splitting per caching granulare
        manualChunks(id) {
          // Three.js WebGPU (chunk separato — solo se importato)
          if (id.includes("three/webgpu")) return "vendor-three-webgpu";
          // Three.js core
          if (id.includes("/three/") || id.includes("\\three\\")) {
            return "vendor-three";
          }
          // Rapier physics
          if (id.includes("yuka")) return "vendor-yuka";
          if (id.includes("@recast-navigation")) return "vendor-recast";
          // IDB (meta-progressione)
          if (id.includes("/idb/") || id.includes("\\idb\\")) {
            return "vendor-idb";
          }
          // Font (woff2 non-JS, ma i loader TS vanno qui)
          if (
            id.includes("@fontsource/cinzel") ||
            id.includes("@fontsource/noto-sans")
          ) {
            return "vendor-fonts";
          }
          // Zod (validazione seed)
          if (id.includes("/zod/") || id.includes("\\zod\\")) {
            return "vendor-zod";
          }
          // Gameplay logic chunks (source code)
          if (
            id.includes("/src/rendering/") ||
            id.includes("\\src\\rendering\\")
          ) {
            return "floor-renderer";
          }
          if (id.includes("/src/meta/") || id.includes("\\src\\meta\\")) {
            return "meta-progression";
          }
          if (
            id.includes("/src/gameplay/DailyChallengeSystem") ||
            id.includes("\\src\\gameplay\\DailyChallengeSystem")
          ) {
            return "daily-challenge";
          }
          if (
            id.includes("/src/analytics/") ||
            id.includes("\\src\\analytics\\")
          ) {
            return "analytics";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    open: true,
    headers: {
      // COEP/COOP necessari per SharedArrayBuffer (Rapier WASM threading)
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});
