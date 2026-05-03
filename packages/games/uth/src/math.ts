// packages/games/uth/src/math.ts
//
// Pay tables and helpers for UTH.
// See docs/UTH.md § 2.

import type { HandRankName } from './types.js';

/**
 * Blind bet pay table — ratio of winnings to stake when the player wins
 * the hand (or a sufficient hand for the bonus). The 1:1 default applies
 * for hands below straight when the player wins.
 */
export const BLIND_PAYTABLE: Readonly<Record<HandRankName, number>> = {
  royal_flush: 500,
  straight_flush: 50,
  four_kind: 10,
  full_house: 3,
  flush: 1.5,
  straight: 1,
  three_kind: 1,
  two_pair: 1,
  pair: 1,
  high_card: 1,
};

/**
 * Trips side bet pay table.
 */
export const TRIPS_PAYTABLE: Readonly<Record<HandRankName, number>> = {
  royal_flush: 50,
  straight_flush: 40,
  four_kind: 30,
  full_house: 8,
  flush: 7,
  straight: 4,
  three_kind: 3,
  two_pair: 0,
  pair: 0,
  high_card: 0,
};

/**
 * Multiplier rounding precision: 4 decimal places.
 */
const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Computes gross payout (winnings + stake) given stake and win multiplier.
 *
 * @example
 *   computePayout(10, 1) → 20  (1:1 win)
 *   computePayout(10, 0.5) → 15 (1:2 partial — not used in UTH)
 */
export function computePayout(stake: bigint, winMultiplier: number): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (!Number.isFinite(winMultiplier) || winMultiplier < 0) {
    throw new RangeError('winMultiplier must be a non-negative finite number');
  }
  // gross = stake * (winMultiplier + 1)
  const scaledMul = BigInt(Math.round((winMultiplier + 1) * MULTIPLIER_ROUND_FACTOR));
  const denom = BigInt(MULTIPLIER_ROUND_FACTOR);
  return (stake * scaledMul) / denom;
}
