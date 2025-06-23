import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import json from '@eslint/json';
import css from '@eslint/css';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
    },
  },

  {
    rules: {
      ...prettier.rules,
    },
  },

  {
    files: ['**/*.json'],
    plugins: { json },
    languageOptions: {
      parser: json.parsers['json'],
    },
    rules: {
      ...json.configs.recommended.rules,
    },
  },

  {
    files: ['**/*.css'],
    plugins: { css },
    languageOptions: {
      parser: css.parsers['css'],
    },
    rules: {
      ...css.configs.recommended.rules,
    },
  },
]);
