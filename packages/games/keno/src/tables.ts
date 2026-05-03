// packages/games/keno/src/tables.ts
//
// Keno pay tables.
//
// Indexed by (number of picks, number of hits) → multiplier.
// We use the published Stake-style "classic" risk. Other risks (low / medium /
// high) flatten or steepen the curve; we expose only "classic" in v1 and add
// stubs for the others that mirror "classic" (so the API supports the type
// without changing payouts). When a game-server is added we can populate
// the full risk-tiered tables.
//
// Multipliers are GROSS (player gets stake × multiplier on win).
// Numbers below 1 indicate partial payouts (rare on Keno; included for
// completeness if config tables vary).

import type { KenoRisk } from './types.js';

/**
 * Pay table indexed by [picks][hits].
 *
 * Source: published Stake-style "Classic" Keno table.
 * Keys are integer picks 1..10. Values are arrays of length picks+1 (0..picks hits).
 */
const CLASSIC_TABLE: Readonly<Record<number, readonly number[]>> = {
  1: [0.7, 1.85],
  2: [0, 2, 3.8],
  3: [0, 1.1, 1.38, 26],
  4: [0, 0, 2.2, 7.9, 90],
  5: [0, 0, 1.5, 4.2, 13, 300],
  6: [0, 0, 1.1, 2, 6.2, 100, 700],
  7: [0, 0, 1.1, 1.5, 3.5, 15, 225, 700],
  8: [0, 0, 1.1, 1.5, 2, 5.5, 39, 100, 800],
  9: [0, 0, 1.1, 1.3, 1.7, 2.5, 7.5, 50, 250, 1000],
  10: [0, 0, 1.1, 1.2, 1.3, 1.8, 3.5, 13, 50, 250, 1000],
};

/**
 * Returns the gross multiplier for (picks, hits) at the given risk.
 *
 * @throws RangeError on invalid picks count
 */
export function multiplierFor(picks: number, hits: number, risk: KenoRisk): number {
  if (!Number.isInteger(picks) || picks < 1 || picks > 10) {
    throw new RangeError('picks count must be integer 1..10');
  }
  if (!Number.isInteger(hits) || hits < 0 || hits > picks) {
    throw new RangeError(`hits must be 0..${String(picks)}`);
  }
  // For v1, all risk levels share the classic table.
  void risk;
  const row = CLASSIC_TABLE[picks];
  /* v8 ignore next 1 -- bounds checked above */
  if (row === undefined) return 0;
  return row[hits] ?? 0;
}

/** All allowed risk levels for v1. */
export const KENO_RISKS: readonly KenoRisk[] = ['low', 'medium', 'high', 'classic'];
