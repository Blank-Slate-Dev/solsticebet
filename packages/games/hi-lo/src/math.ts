// packages/games/hi-lo/src/math.ts
//
// Hi-Lo math: per-pick odds and multiplier accumulation.
//
// Card ranks 0..12 where 0=Ace (low), 12=King (high).
// "higher_or_equal" wins if next card rank ≥ current card rank.
// "lower_or_equal" wins if next card rank ≤ current card rank.
//
// We use ≥ / ≤ (rather than strict > / <) to give the player a wider winning
// set when the current card is at an extreme (e.g. King → "higher_or_equal"
// would always lose with strict >; with ≥, ties win).

import type { HiLoPick } from './types.js';

/**
 * Probability the next card satisfies the pick given the current card rank.
 *
 * higher_or_equal: rank in [current, 12] — count = (13 - current)
 * lower_or_equal:  rank in [0, current] — count = (current + 1)
 */
export function pickProbability(currentRank: number, pick: HiLoPick): number {
  if (!Number.isInteger(currentRank) || currentRank < 0 || currentRank >= 13) {
    throw new RangeError('currentRank must be 0..12');
  }
  if (pick === 'higher_or_equal') {
    return (13 - currentRank) / 13;
  }
  return (currentRank + 1) / 13;
}

/**
 * Multiplier earned for a winning pick at the given probability.
 * Uses 1% house edge: multiplier = 0.99 / probability.
 *
 * Examples:
 *   p = 0.5 → 1.98×
 *   p = 0.077 (King → higher_or_equal: only K wins) → 12.87×
 */
export function pickMultiplier(probability: number): number {
  if (probability <= 0 || probability > 1) {
    throw new RangeError('probability must be in (0, 1]');
  }
  return 0.99 / probability;
}

/**
 * Computes payout = floor(stake × multiplier) at 4-dp precision.
 */
export function computePayout(stake: bigint, multiplier: number): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    throw new RangeError('multiplier must be positive finite');
  }
  const SCALE = 10000;
  const scaledMul = BigInt(Math.round(multiplier * SCALE));
  return (stake * scaledMul) / BigInt(SCALE);
}

/**
 * Returns the picks available given the current card rank.
 *
 * At rank 0 (Ace), "higher_or_equal" would be 100% probability (every card
 * wins) and pays only 0.99× — a guaranteed near-no-op. We disable it.
 * At rank 12 (King), the same applies to "lower_or_equal".
 *
 * In the middle range, both directions are valid and competitive.
 */
export function availablePicks(currentRank: number): readonly HiLoPick[] {
  if (!Number.isInteger(currentRank) || currentRank < 0 || currentRank >= 13) {
    throw new RangeError('currentRank must be 0..12');
  }
  if (currentRank === 0) return ['higher_or_equal'];
  if (currentRank === 12) return ['lower_or_equal'];
  return ['higher_or_equal', 'lower_or_equal'];
}

/**
 * Returns true if pick correctly predicts next rank vs current rank.
 */
export function isWinningPick(currentRank: number, nextRank: number, pick: HiLoPick): boolean {
  if (pick === 'higher_or_equal') return nextRank >= currentRank;
  return nextRank <= currentRank;
}
