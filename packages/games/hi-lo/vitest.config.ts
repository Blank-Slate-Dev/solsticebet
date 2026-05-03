// packages/games/hi-lo/vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/types.ts'],
      thresholds: {
        lines: 88,
        functions: 100,
        statements: 88,
        branches: 80,
      },
    },
  },
});
