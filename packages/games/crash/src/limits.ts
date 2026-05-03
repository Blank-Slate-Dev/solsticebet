// packages/games/crash/src/limits.ts
//
// Crash bet limits and validation.
// See docs/CRASH.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import type { CrashBetInput } from './types.js';

export class CrashValidationError extends Error {
  override readonly name: string = 'CrashValidationError';
}

/** Minimum stake. */
export const MIN_STAKE: bigint = parseAmount('0.01');

/** Maximum stake. */
export const MAX_STAKE: bigint = parseAmount('1000');

/** Minimum auto-cash-out target. Below 1.01× would be effectively never-win. */
export const MIN_AUTO_CASHOUT = 1.01;

/** Maximum auto-cash-out target — matches the RNG ceiling. */
export const MAX_AUTO_CASHOUT = 1_000_000;

/** Maximum payout per bet (defence in depth). */
export const MAX_PAYOUT: bigint = parseAmount('100000');

export function assertValidStake(stake: bigint): void {
  if (typeof stake !== 'bigint') {
    throw new CrashValidationError('stake must be a bigint');
  }
  if (stake < MIN_STAKE) {
    throw new CrashValidationError('stake is below minimum');
  }
  if (stake > MAX_STAKE) {
    throw new CrashValidationError('stake exceeds maximum');
  }
}

export function assertValidAutoCashOut(autoCashOut: number): void {
  if (!Number.isFinite(autoCashOut)) {
    throw new CrashValidationError('autoCashOut must be a finite number');
  }
  if (autoCashOut < MIN_AUTO_CASHOUT) {
    throw new CrashValidationError(`autoCashOut must be at least ${String(MIN_AUTO_CASHOUT)}`);
  }
  if (autoCashOut > MAX_AUTO_CASHOUT) {
    throw new CrashValidationError(`autoCashOut must be at most ${String(MAX_AUTO_CASHOUT)}`);
  }
  // Quantise to 0.01 precision (typical Crash UI granularity).
  const scaled = autoCashOut * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw new CrashValidationError('autoCashOut must be in 0.01 increments');
  }
}

export function assertValidBetInput(input: CrashBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new CrashValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new CrashValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new CrashValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new CrashValidationError('houseAccountId must be a non-empty string');
  }
  assertValidStake(input.stake);
  assertValidAutoCashOut(input.autoCashOut);
  if (input.currency !== 'INTERNAL_USDT') {
    throw new CrashValidationError(`crash bets must be in INTERNAL_USDT, got ${input.currency}`);
  }
}
