// packages/games/plinko/src/math.ts
//
// Pure math for Plinko.
// See docs/PLINKO.md § 2.

import { SCALE_FACTOR } from '@solsticebet/ledger';

import { getTable } from './tables.js';
import type { PlinkoRisk, PlinkoRows } from './types.js';

/**
 * Multiplier rounding precision (4 decimal places), matching Dice and Mines.
 */
const MULTIPLIER_DECIMALS = 4;
const MULTIPLIER_ROUND_FACTOR = 10 ** MULTIPLIER_DECIMALS;

/**
 * Returns the multiplier for a given outcome.
 */
export function multiplierForBucket(rows: PlinkoRows, risk: PlinkoRisk, bucket: number): number {
  const table = getTable(rows, risk);
  if (!Number.isInteger(bucket) || bucket < 0 || bucket >= table.length) {
    throw new RangeError(`bucket ${String(bucket)} out of range for ${String(rows)} rows`);
  }
  const value = table[bucket];
  /* v8 ignore next 3 -- guarded by bounds check above; defensive for noUncheckedIndexedAccess */
  if (value === undefined) {
    throw new RangeError(`bucket ${String(bucket)} index returned undefined`);
  }
  return value;
}

/**
 * Computes payout = floor(stake × multiplier) at ledger SCALE precision.
 */
export function computePayout(stake: bigint, multiplier: number): bigint {
  if (stake <= 0n) {
    throw new RangeError('stake must be positive');
  }
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new RangeError('multiplier must be a non-negative finite number');
  }
  const scaledMul = BigInt(Math.round(multiplier * MULTIPLIER_ROUND_FACTOR));
  const denom = BigInt(MULTIPLIER_ROUND_FACTOR);
  return (stake * scaledMul) / denom;
}

/**
 * Computes the binomial coefficient C(n, k).
 * Used for RTP calculation and tests.
 */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let res = 1;
  const lim = Math.min(k, n - k);
  for (let i = 0; i < lim; i++) {
    res = (res * (n - i)) / (i + 1);
  }
  return res;
}

/**
 * Computes the theoretical RTP for a (rows, risk) table.
 * RTP = sum over k of (probability of bucket k) × multiplier(k).
 */
export function rtpFor(rows: PlinkoRows, risk: PlinkoRisk): number {
  const table = getTable(rows, risk);
  const total = 2 ** rows;
  let rtp = 0;
  for (let k = 0; k <= rows; k++) {
    const m = table[k];
    /* v8 ignore next -- defensive; loop bounds match table length */
    if (m === undefined) continue;
    rtp += (binomial(rows, k) / total) * m;
  }
  return rtp;
}

/** Re-export ledger SCALE_FACTOR for callers. */
export { SCALE_FACTOR };
