import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
  {
    ignores: [
      '**/node_modules/',
      'apps/web/build/',
      'apps/web/.svelte-kit/',
      '**/playwright-report/',
      '**/test-results/',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['apps/web/**/*'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // RNF-09: niente alert/confirm/prompt, le conferme stanno nella pagina.
      'no-alert': 'error',
      'no-restricted-globals': ['error', 'alert', 'confirm', 'prompt'],
    },
  },
  {
    // RNF-06: i testi degli utenti si mostrano come testo, mai come HTML.
    files: ['**/*.svelte'],
    rules: { 'svelte/no-at-html-tags': 'error' },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
);
