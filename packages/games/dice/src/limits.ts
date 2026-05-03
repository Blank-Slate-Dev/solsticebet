// packages/games/dice/src/limits.ts
//
// Dice bet limits + input validation.
// See docs/DICE.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import type { DiceBetInput, DiceMode } from './types.js';

export class DiceValidationError extends Error {
  override readonly name: string = 'DiceValidationError';
}

/**
 * Minimum stake per bet, scaled bigint with 18 decimal places.
 * 0.01 INTERNAL_USDT.
 */
export const MIN_STAKE: bigint = parseAmount('0.01');

/**
 * Maximum stake per bet (default tier).
 * VIP tiers may raise this; for v1 we keep a single conservative cap.
 * 1000 INTERNAL_USDT.
 */
export const MAX_STAKE: bigint = parseAmount('1000');

/**
 * Minimum target. Below this, the multiplier explodes and the math gets
 * unstable around the quantisation boundary.
 */
export const MIN_TARGET = 2;

/**
 * Maximum target.
 */
export const MAX_TARGET = 98;

/**
 * Maximum payout per single bet — defense in depth against math bugs.
 * 1000 stake × 49.5 max multiplier = 49500 INTERNAL_USDT.
 */
export const MAX_PAYOUT: bigint = parseAmount('49500');

/**
 * Allowed modes — also used as a runtime check.
 */
export const MODES: readonly DiceMode[] = ['under', 'over'] as const;

/**
 * Validates target is in [MIN_TARGET, MAX_TARGET] at 0.01 precision.
 *
 * @throws DiceValidationError on any failure
 */
export function assertValidTarget(target: number): void {
  if (!Number.isFinite(target)) {
    throw new DiceValidationError('target must be a finite number');
  }
  if (target < MIN_TARGET || target > MAX_TARGET) {
    throw new DiceValidationError(
      `target must be between ${String(MIN_TARGET)} and ${String(MAX_TARGET)}`,
    );
  }
  // 0.01 precision check: target * 100 should be an integer.
  // Multiply, round, and check the deviation against a small epsilon to
  // tolerate float representation noise (e.g., 49.99 * 100 = 4998.9999...).
  const scaled = target * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw new DiceValidationError('target must be in 0.01 increments');
  }
}

/**
 * Validates mode is one of the allowed values.
 */
export function assertValidMode(mode: string): void {
  if (mode !== 'under' && mode !== 'over') {
    throw new DiceValidationError(`mode must be 'under' or 'over'`);
  }
}

/**
 * Validates stake is in [MIN_STAKE, MAX_STAKE].
 */
export function assertValidStake(stake: bigint): void {
  if (typeof stake !== 'bigint') {
    throw new DiceValidationError('stake must be a bigint');
  }
  if (stake < MIN_STAKE) {
    throw new DiceValidationError('stake is below minimum');
  }
  if (stake > MAX_STAKE) {
    throw new DiceValidationError('stake exceeds maximum');
  }
}

/**
 * Composite validation of a DiceBetInput — runs every check and throws
 * a DiceValidationError on the first failure.
 */
export function assertValidBetInput(input: DiceBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new DiceValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new DiceValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new DiceValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new DiceValidationError('houseAccountId must be a non-empty string');
  }
  assertValidStake(input.stake);
  assertValidTarget(input.target);
  assertValidMode(input.mode);
  if (input.currency !== 'INTERNAL_USDT') {
    throw new DiceValidationError(`dice bets must be in INTERNAL_USDT, got ${input.currency}`);
  }
}
