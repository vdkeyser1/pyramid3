import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],
    },
  },
  {
    // Il codice di test ha esigenze diverse dal codice di produzione.
    files: ["tests/**/*.ts"],
    rules: {
      // In un test il non-null assertion e' lo strumento corretto: se il
      // presupposto e' sbagliato il test deve fallire subito e in modo
      // rumoroso. Sostituirlo con `?.` o guardie fa passare silenziosamente
      // test le cui precondizioni sono saltate — l'esatto contrario di cio'
      // che serve.
      "@typescript-eslint/no-non-null-assertion": "off",
      // Idiomatico nelle asserzioni: expect(() => fn()).toThrow()
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },
  {
    ignores: [
      "dist/",
      "dist_verify/",
      "node_modules/",
      "test-results/",
      "playwright-report/",
      "e2e/",
      "vite.config.ts",
      "vitest.config.ts",
      "vitest.config.dom.ts",
      "playwright.config.ts",
      "eslint.config.mjs",
      "scripts/",
      // Asset serviti così come sono: codice di terze parti (decoder Draco di
      // Google) e worklet audio che gira fuori dal bundle. Non è codice nostro
      // e non deve essere sottoposto alle regole del progetto.
      "public/",
    ],
  },
);
