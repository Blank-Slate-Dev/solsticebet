// packages/games/sicbo/src/math.ts
//
// Sic Bo payout math.
// See docs/SICBO.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

/**
 * Computes the gross payout for a winning bet (stake × (winMultiplier + 1)).
 *
 * @throws RangeError on non-positive stake or negative multiplier
 */
export function computePayout(stake: bigint, winMultiplier: number): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (!Number.isInteger(winMultiplier) || winMultiplier < 0) {
    throw new RangeError('winMultiplier must be a non-negative integer');
  }
  return stake * BigInt(winMultiplier + 1);
}

/** Re-export ledger SCALE_FACTOR. */
export { SCALE_FACTOR };
