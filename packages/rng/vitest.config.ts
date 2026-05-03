// packages/rng/vitest.config.ts

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
      // 100% line coverage on the RNG core is mandatory (RNG.md § 9.5).
      thresholds: {
        lines: 100,
        functions: 100,
        statements: 100,
        // Branch coverage is harder to hit 100% due to defensive branches;
        // we set a high floor and accept practical exceptions on case-by-case basis.
        branches: 90,
      },
    },
  },
});
