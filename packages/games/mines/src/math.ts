// packages/games/mines/src/math.ts
//
// Pure math for Mines.
// See docs/MINES.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

/**
 * Total tiles in a Mines round. Fixed at 25 in v1.
 */
export const TOTAL_TILES = 25;

/**
 * House edge. Locked at 3% per docs/MINES.md § 2.1.
 */
export const HOUSE_EDGE = 0.03;

/**
 * Multiplier rounding precision (4 decimal places).
 */
const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Returns the fair (zero-edge) multiplier for revealing N safe tiles
 * consecutively from a 25-tile grid with M mines.
 *
 * Math:
 *   P(safe N) = C(T-M, N) / C(T, N)
 *             = product over k=0..(N-1) of (T-M-k) / (T-k)
 *   fair multiplier = 1 / P(safe N)
 *
 * We compute the product directly (avoiding factorials, which overflow fast)
 * and then invert. Stable for all valid (M, N).
 *
 * @throws RangeError if (mineCount, safeRevealed) are out of valid bounds
 */
export function fairMultiplier(mineCount: number, safeRevealed: number): number {
  assertValidMineState(mineCount, safeRevealed);
  // Product P(safe N) = ∏ (T-M-k) / (T-k), for k = 0..(N-1).
  let p = 1;
  for (let k = 0; k < safeRevealed; k++) {
    const numerator = TOTAL_TILES - mineCount - k;
    const denominator = TOTAL_TILES - k;
    p *= numerator / denominator;
  }
  /* v8 ignore next 5 -- defensive; unreachable given assertValidMineState above */
  if (p <= 0) {
    // Means safeRevealed > T - M; shouldn't reach here given assert, but
    // defensive in case future callers pre-bypass validation.
    throw new RangeError('safeRevealed exceeds available safe tiles');
  }
  return 1 / p;
}

/**
 * Returns the displayable multiplier for the given round state, with the
 * 3% house edge applied and rounded to 4 decimal places.
 */
export function multiplierFor(mineCount: number, safeRevealed: number): number {
  if (safeRevealed === 0) {
    // No reveals yet → no winnable multiplier; the convention is 1.0.
    return 1.0;
  }
  const fair = fairMultiplier(mineCount, safeRevealed);
  const withEdge = (1 - HOUSE_EDGE) * fair;
  return Math.round(withEdge * MULTIPLIER_ROUND_FACTOR) / MULTIPLIER_ROUND_FACTOR;
}

/**
 * Computes the payout for a winning bet at the given multiplier.
 * Same convention as Dice: floor to ledger SCALE precision.
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
 * Asserts the (mineCount, safeRevealed) pair is internally consistent.
 *
 * @throws RangeError if invalid
 */
export function assertValidMineState(mineCount: number, safeRevealed: number): void {
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) {
    throw new RangeError('mineCount must be an integer in [1, 24]');
  }
  if (!Number.isInteger(safeRevealed) || safeRevealed < 0) {
    throw new RangeError('safeRevealed must be a non-negative integer');
  }
  const maxSafe = TOTAL_TILES - mineCount;
  if (safeRevealed > maxSafe) {
    throw new RangeError(
      `safeRevealed ${String(safeRevealed)} exceeds available safe tiles ${String(maxSafe)}`,
    );
  }
}

/**
 * The maximum multiplier achievable for the given mine count
 * (revealing every safe tile).
 */
export function maxMultiplierFor(mineCount: number): number {
  return multiplierFor(mineCount, TOTAL_TILES - mineCount);
}

/** Re-export ledger SCALE_FACTOR for callers that need it. */
export { SCALE_FACTOR };
