// packages/games/sicbo/src/limits.ts
//
// Sic Bo bet limits and validation.
// See docs/SICBO.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import type { SicBoBet, SicBoRollInput } from './types.js';

export class SicBoValidationError extends Error {
  override readonly name: string = 'SicBoValidationError';
}

/** Minimum stake per individual bet. */
export const MIN_BET_STAKE: bigint = parseAmount('0.01');

/** Maximum stake per individual bet. */
export const MAX_BET_STAKE: bigint = parseAmount('1000');

/** Maximum total stake across all bets in a single roll. */
export const MAX_ROLL_STAKE: bigint = parseAmount('10000');

/** Maximum number of bets per roll. */
export const MAX_BETS_PER_ROLL = 100;

/** Maximum payout per roll (defence in depth). */
export const MAX_ROLL_PAYOUT: bigint = parseAmount('200000');

export function assertValidBet(bet: SicBoBet): void {
  if (typeof bet.stake !== 'bigint') {
    throw new SicBoValidationError('bet.stake must be a bigint');
  }
  if (bet.stake < MIN_BET_STAKE) {
    throw new SicBoValidationError('bet stake is below minimum');
  }
  if (bet.stake > MAX_BET_STAKE) {
    throw new SicBoValidationError('bet stake exceeds maximum');
  }
}

export function assertValidRollInput(input: SicBoRollInput): void {
  if (typeof input.rollId !== 'string' || input.rollId.length === 0) {
    throw new SicBoValidationError('rollId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new SicBoValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new SicBoValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new SicBoValidationError('houseAccountId must be a non-empty string');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new SicBoValidationError(`sic bo rolls must be in INTERNAL_USDT, got ${input.currency}`);
  }

  const betsUnknown: unknown = input.bets;
  if (!Array.isArray(betsUnknown) || betsUnknown.length === 0) {
    throw new SicBoValidationError('roll must have at least one bet');
  }
  const bets = betsUnknown as readonly SicBoBet[];
  if (bets.length > MAX_BETS_PER_ROLL) {
    throw new SicBoValidationError(
      `roll has ${String(bets.length)} bets; max is ${String(MAX_BETS_PER_ROLL)}`,
    );
  }

  let totalStake = 0n;
  for (const bet of bets) {
    assertValidBet(bet);
    totalStake += bet.stake;
  }
  if (totalStake > MAX_ROLL_STAKE) {
    throw new SicBoValidationError('total roll stake exceeds maximum');
  }
}
