// packages/games/roulette/src/limits.ts
//
// Bet limits and input validation for Roulette.
// See docs/ROULETTE.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import type { RouletteBet, RouletteSpinInput } from './types.js';

export class RouletteValidationError extends Error {
  override readonly name: string = 'RouletteValidationError';
}

/** Minimum stake per individual bet. */
export const MIN_BET_STAKE: bigint = parseAmount('0.01');

/** Maximum stake per individual bet. */
export const MAX_BET_STAKE: bigint = parseAmount('1000');

/** Maximum total stake across all bets in a single spin. */
export const MAX_SPIN_STAKE: bigint = parseAmount('10000');

/** Maximum number of bets per spin. */
export const MAX_BETS_PER_SPIN = 200;

/** Maximum payout per spin (defence in depth). */
export const MAX_SPIN_PAYOUT: bigint = parseAmount('100000');

export function assertValidBet(bet: RouletteBet): void {
  if (typeof bet.stake !== 'bigint') {
    throw new RouletteValidationError('bet.stake must be a bigint');
  }
  if (bet.stake < MIN_BET_STAKE) {
    throw new RouletteValidationError('bet stake is below minimum');
  }
  if (bet.stake > MAX_BET_STAKE) {
    throw new RouletteValidationError('bet stake exceeds maximum');
  }
}

export function assertValidSpinInput(input: RouletteSpinInput): void {
  if (typeof input.spinId !== 'string' || input.spinId.length === 0) {
    throw new RouletteValidationError('spinId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new RouletteValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new RouletteValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new RouletteValidationError('houseAccountId must be a non-empty string');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new RouletteValidationError(
      `roulette spins must be in INTERNAL_USDT, got ${input.currency}`,
    );
  }
  const betsUnknown: unknown = input.bets;
  if (!Array.isArray(betsUnknown) || betsUnknown.length === 0) {
    throw new RouletteValidationError('spin must have at least one bet');
  }
  const bets = betsUnknown as readonly RouletteBet[];
  if (bets.length > MAX_BETS_PER_SPIN) {
    throw new RouletteValidationError(
      `spin has ${String(bets.length)} bets; max is ${String(MAX_BETS_PER_SPIN)}`,
    );
  }

  let totalStake = 0n;
  for (const bet of bets) {
    assertValidBet(bet);
    totalStake += bet.stake;
  }
  if (totalStake > MAX_SPIN_STAKE) {
    throw new RouletteValidationError('total spin stake exceeds maximum');
  }
}
