import tseslint from 'typescript-eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

export default [
  // Global ignores
  { ignores: ['dist/**', 'node_modules/**', 'site/**', '*.xpi', 'build.ts'] },

  // TypeScript base
  ...tseslint.configs.recommended,

  // TypeScript source files
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      // We use /// <reference> for messenger.d.ts in Svelte components
      '@typescript-eslint/triple-slash-reference': 'off',
      'no-console': 'off',
    },
  },

  // Test files — relaxed rules
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Svelte files
  ...sveltePlugin.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
    rules: {
      // Svelte reactive statements and $props trigger false positives
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_|\\$' }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      // {#each} without keys — warn, don't block
      'svelte/require-each-key': 'warn',
      // SvelteSet suggestion — informational
      'svelte/prefer-svelte-reactivity': 'warn',
      // svelte-ignore comments that may be stale
      'svelte/no-unused-svelte-ignore': 'warn',
      // We intentionally use {@html} for markdown rendering
      'svelte/no-at-html-tags': 'off',
      // Suggests writable $derived — informational
      'svelte/prefer-writable-derived': 'warn',
    },
  },

  // Disable rules conflicting with Prettier (must come last)
  prettier,
];
