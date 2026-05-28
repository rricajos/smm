import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['src/lib/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/**/main.ts',
        'src/lib/test-setup.ts',
        'src/lib/test-utils.ts',
      ],
      thresholds: {
        statements: 93,
        branches: 87,
        functions: 95,
        lines: 94,
      },
    },
  },
  resolve: {
    conditions: ['browser'],
    alias: {
      $lib: '/src/lib',
      $types: '/src/types',
    },
  },
});
