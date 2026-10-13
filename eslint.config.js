import js from '@eslint/js';
import globals from 'globals';
export default [
  js.configs.recommended,
  { files: ['src/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  { files: ['vite.config.js', 'eslint.config.js', 'scripts/**/*.js', 'scripts/**/*.mjs'], languageOptions: { globals: globals.node } },
];
