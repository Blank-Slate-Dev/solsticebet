// packages/games/dice/src/math.ts
//
// Pure math for Dice. No I/O, no dependencies on RNG or ledger — just numbers.
// See docs/DICE.md § 2 for the spec.

import { SCALE_FACTOR } from '@solsticebet/ledger';

import type { DiceMode } from './types.js';

/**
 * House edge as a fraction. RTP = 1 - HOUSE_EDGE.
 * Locked at 1% per docs/DICE.md § 2.1.
 */
export const HOUSE_EDGE = 0.01;

/**
 * The numerator of the multiplier formula: 99 (i.e. 100 * (1 - HOUSE_EDGE)).
 * Stored separately to make the math obvious in code review.
 */
export const MULTIPLIER_NUMERATOR = 100 * (1 - HOUSE_EDGE);

/**
 * Multiplier rounding: 4 decimal places. We round the displayed/computed
 * multiplier to a fixed precision so the displayed multiplier and the
 * actual payout always agree.
 */
const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Computes the win-chance percent for the given target and mode.
 *
 * - 'under', target T → win chance = T (% of rolls are < T)
 * - 'over',  target T → win chance = 100 - T (% of rolls are > T)
 *
 * (Equality is a loss; that loss is part of the house edge bookkeeping
 * in the multiplier formula. See docs/DICE.md § 2.2.)
 *
 * @throws RangeError if target is out of (0, 100) — caller should pre-validate
 *  to the tighter [2, 98] range with assertValidTarget.
 */
export function winChancePercent(target: number, mode: DiceMode): number {
  if (!Number.isFinite(target) || target <= 0 || target >= 100) {
    throw new RangeError('target must be in (0, 100)');
  }
  return mode === 'under' ? target : 100 - target;
}

/**
 * Computes the payout multiplier for the given target and mode.
 * Rounded to 4 decimal places.
 *
 * Formula: multiplier = MULTIPLIER_NUMERATOR / winChancePercent
 *
 * @example
 *   computeMultiplier(50, 'under') === 1.98
 *   computeMultiplier(2, 'under')  === 49.5
 *   computeMultiplier(98, 'over')  === 49.5
 */
export function computeMultiplier(target: number, mode: DiceMode): number {
  const wc = winChancePercent(target, mode);
  const raw = MULTIPLIER_NUMERATOR / wc;
  return Math.round(raw * MULTIPLIER_ROUND_FACTOR) / MULTIPLIER_ROUND_FACTOR;
}

/**
 * Determines whether a given roll wins against (target, mode).
 * Equality is always a loss.
 */
export function isWinningRoll(roll: number, target: number, mode: DiceMode): boolean {
  if (!Number.isFinite(roll)) return false;
  return mode === 'under' ? roll < target : roll > target;
}

/**
 * Computes the payout for a winning bet: floor(stake * multiplier) at the
 * ledger SCALE precision (18 decimal places).
 *
 * Implementation note: we multiply the bigint stake by an integer derived
 * from the multiplier, then divide. This avoids any float-precision risk
 * on the bigint side.
 */
export function computePayout(stake: bigint, multiplier: number): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError('multiplier must be a positive finite number');
  }

  // Convert multiplier to a bigint scaled by 10^MULTIPLIER_DECIMALS.
  // Math.round to absorb the float→int conversion noise.
  const scaledMul = BigInt(Math.round(multiplier * MULTIPLIER_ROUND_FACTOR));
  const denom = BigInt(MULTIPLIER_ROUND_FACTOR);

  // payout = stake * (scaledMul / denom)
  // Computed as integer division to floor to ledger SCALE precision.
  return (stake * scaledMul) / denom;
}

/**
 * The expected RTP for any Dice bet, derived from win chance × multiplier.
 * Should always equal 1 - HOUSE_EDGE within float precision.
 *
 * Used by tests to confirm the math is internally consistent.
 */
export function expectedRtp(target: number, mode: DiceMode): number {
  const wc = winChancePercent(target, mode);
  const m = computeMultiplier(target, mode);
  return (wc / 100) * m;
}

/**
 * Re-export SCALE_FACTOR so callers don't need to import from @solsticebet/ledger
 * just to know our precision. Not strictly necessary but improves locality.
 */
export { SCALE_FACTOR };
