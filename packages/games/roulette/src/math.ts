// packages/games/roulette/src/math.ts
//
// Pure math for European Roulette payouts.
// See docs/ROULETTE.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

import type { RouletteBetType } from './types.js';
import { PAYOUTS } from './wheel.js';

/**
 * Computes the gross payout for a winning bet (stake + winnings combined).
 *
 * Formula: stake × (multiplier + 1)
 *
 * For a 'straight' bet at 35:1, $1 stake → $36 gross payout = $35 winnings + $1 stake back.
 *
 * Multipliers are integers (35, 17, 11, 8, 5, 2, 1) so no rounding required.
 *
 * @throws RangeError on non-positive stake
 */
export function computePayout(stake: bigint, type: RouletteBetType): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  const multiplier = PAYOUTS[type];
  return stake * BigInt(multiplier + 1);
}

/**
 * The theoretical RTP for any single bet on European Roulette.
 * 36/37 ≈ 97.297%.
 */
export const THEORETICAL_RTP = 36 / 37;

/** Re-export ledger SCALE_FACTOR. */
export { SCALE_FACTOR };
