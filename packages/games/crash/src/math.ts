// packages/games/crash/src/math.ts
//
// Pure math for Crash payouts.
// See docs/CRASH.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

/**
 * Multiplier rounding precision: 4 decimal places (matches other games).
 * Crash auto-cash-out is conventionally 2 dp; we use 4 to allow precision
 * if needed and to align with the system-wide multiplier scheme.
 */
const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Computes the gross payout for a winning Crash bet (stake × autoCashOut,
 * floored to 18 decimal places).
 *
 * @throws RangeError on non-positive stake or non-positive multiplier
 */
export function computePayout(stake: bigint, multiplier: number): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError('multiplier must be a positive finite number');
  }
  const scaledMul = BigInt(Math.round(multiplier * MULTIPLIER_ROUND_FACTOR));
  const denom = BigInt(MULTIPLIER_ROUND_FACTOR);
  return (stake * scaledMul) / denom;
}

/**
 * Determines whether a bet wins given the bust and auto-cash-out.
 * Player wins if the bust point reached or exceeded the auto-cash-out target.
 */
export function isWinningBet(bustAt: number, autoCashOut: number): boolean {
  return bustAt >= autoCashOut;
}

/** Re-export ledger SCALE_FACTOR. */
export { SCALE_FACTOR };
