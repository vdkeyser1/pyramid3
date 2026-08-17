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
        globPatterns: ["**/*.{js,css,html,glb,jpg,png,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: process.env.VITE_SOURCEMAP === "true",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@dimforge/rapier3d-compat")) return "rapier";
          if (id.includes("three/webgpu")) return "three.webgpu";
          if (id.includes("/three/") || id.includes("\\three\\")) {
            return "rendering";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    open: true,
  },
});
