// packages/games/baccarat/src/math.ts
//
// Baccarat payout math.
// See docs/BACCARAT.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

import type { BaccaratBetType } from './types.js';

/**
 * Payout multipliers (excluding stake return). See docs/BACCARAT.md § 2.1.
 */
export const PAYOUTS: Readonly<Record<BaccaratBetType, number>> = {
  player: 1,
  banker: 0.95, // 1:1 minus 5% commission
  tie: 8,
};

/**
 * Multiplier rounding precision.
 */
const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Computes the gross payout (winnings + returned stake) for a winning bet.
 *
 * For Player: stake × 2 (1:1 + stake)
 * For Banker: stake × 1.95 (0.95:1 + stake; commission baked in)
 * For Tie:    stake × 9 (8:1 + stake)
 *
 * @throws RangeError on non-positive stake
 */
export function computePayout(stake: bigint, type: BaccaratBetType): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  const multiplier = PAYOUTS[type];
  // Gross payout = stake × (multiplier + 1).
  // We compute via scaled bigint to avoid float precision in the bigint result.
  const scaledMul = BigInt(Math.round((multiplier + 1) * MULTIPLIER_ROUND_FACTOR));
  const denom = BigInt(MULTIPLIER_ROUND_FACTOR);
  return (stake * scaledMul) / denom;
}

/** Re-export ledger SCALE_FACTOR. */
export { SCALE_FACTOR };
