/**
 * Dichiarazioni ambient per side-effect import di asset non-TypeScript
 * (CSS da fontsource). Con verbatimModuleSyntax TS non conosce i moduli
 * .css: questa dichiarazione li marca come side-effect import validi.
 */
declare module '*.css';
