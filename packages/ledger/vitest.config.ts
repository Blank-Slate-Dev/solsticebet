// packages/ledger/vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      // index.ts is a pure re-export aggregator with no executable logic.
      exclude: ['src/index.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 90,
      },
    },
  },
});
