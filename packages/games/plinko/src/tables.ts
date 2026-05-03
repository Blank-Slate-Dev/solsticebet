// packages/games/plinko/src/tables.ts
//
// Plinko payout tables. Indexed by (rows, risk).
// Each table has rows + 1 entries; index = bucket number = count of "right"
// decisions in the ball's path.
//
// Tables are symmetric: table[k] === table[rows - k].
// All tables target ~99% RTP (within ±0.15pp due to multiplier rounding to
// human-readable values like 1.5×, 13×, etc.).
//
// These are the published Stake-derivative tables used across the crypto
// casino market. Cert labs already understand them.

import type { PlinkoRisk, PlinkoRows } from './types.js';

/**
 * Multiplier table indexed by `(rows, risk)`.
 */
const TABLES: Record<PlinkoRows, Record<PlinkoRisk, readonly number[]>> = {
  8: {
    low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  12: {
    low: [10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10],
    medium: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  },
  16: {
    low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
    medium: [110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110],
    high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
  },
};

/**
 * Returns the multiplier table for the given (rows, risk).
 */
export function getTable(rows: PlinkoRows, risk: PlinkoRisk): readonly number[] {
  const byRows = TABLES[rows];
  return byRows[risk];
}

/**
 * Returns the maximum multiplier in the (rows, risk) table.
 * Used for the MAX_PAYOUT cap check.
 */
export function maxMultiplier(rows: PlinkoRows, risk: PlinkoRisk): number {
  const table = getTable(rows, risk);
  let max = 0;
  for (const m of table) {
    if (m > max) max = m;
  }
  return max;
}
