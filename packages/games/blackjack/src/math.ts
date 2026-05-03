// packages/games/blackjack/src/math.ts
//
// Blackjack payout math.
// See docs/BLACKJACK.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

/**
 * The blackjack payout is 3:2, encoded as 1.5×.
 */
export const BLACKJACK_PAYOUT_MULTIPLIER = 1.5;

const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Computes the gross payout for a winning hand.
 *
 * @param stake the stake on this hand (post-doubles if applicable)
 * @param isBlackjack true if natural blackjack — pays 2.5× stake
 * @returns gross payout including stake return
 */
export function computeWinPayout(stake: bigint, isBlackjack: boolean): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (isBlackjack) {
    // 2.5× stake = stake × (1.5 + 1)
    const scaledMul = BigInt(
      Math.round((BLACKJACK_PAYOUT_MULTIPLIER + 1) * MULTIPLIER_ROUND_FACTOR),
    );
    const denom = BigInt(MULTIPLIER_ROUND_FACTOR);
    return (stake * scaledMul) / denom;
  }
  // Regular win: 2× stake
  return stake * 2n;
}

/** Re-export ledger SCALE_FACTOR. */
export { SCALE_FACTOR };
