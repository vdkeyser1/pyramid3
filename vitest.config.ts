import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: [
      "tests/dom/**",
      "tests/meta/**",
      "tests/analytics/**",
      "tests/rendering/InstancedDungeonRenderer.test.ts",
      "tests/audio/SyntheticImpulseResponse.test.ts",
      "tests/gameplay/DailyChallengeSystem.test.ts",
      "tests/input/GamepadAdapter.test.ts",
      "tests/platform/ReducedMotionAdapter.test.ts",
    ],
    globals: true,
    environment: "node",
    pool: "threads",
    isolate: true,
  },
});
