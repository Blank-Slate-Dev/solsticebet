// packages/games/blackjack/src/limits.ts
//
// Blackjack bet limits and validation.
// See docs/BLACKJACK.md § 4.

import { parseAmount } from '@solsticebet/ledger';

import type { StartBlackjackRoundInput } from './types.js';

export class BlackjackValidationError extends Error {
  override readonly name: string = 'BlackjackValidationError';
}

/** Minimum starting stake. */
export const MIN_STAKE: bigint = parseAmount('0.01');

/** Maximum starting stake. */
export const MAX_STAKE: bigint = parseAmount('1000');

/** Maximum total stake committed across one round (initial + doubles + splits). */
export const MAX_TOTAL_STAKE: bigint = parseAmount('8000');

/** Maximum payout per round (defence in depth). */
export const MAX_PAYOUT: bigint = parseAmount('12000');

/** Maximum number of player hands in one round (after splits). */
export const MAX_HANDS = 4;

export function assertValidStake(stake: bigint): void {
  if (typeof stake !== 'bigint') {
    throw new BlackjackValidationError('stake must be a bigint');
  }
  if (stake < MIN_STAKE) {
    throw new BlackjackValidationError('stake is below minimum');
  }
  if (stake > MAX_STAKE) {
    throw new BlackjackValidationError('stake exceeds maximum');
  }
}

export function assertValidStartInput(input: StartBlackjackRoundInput): void {
  if (typeof input.roundId !== 'string' || input.roundId.length === 0) {
    throw new BlackjackValidationError('roundId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new BlackjackValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new BlackjackValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new BlackjackValidationError('houseAccountId must be a non-empty string');
  }
  assertValidStake(input.stake);
  if (input.currency !== 'INTERNAL_USDT') {
    throw new BlackjackValidationError(
      `blackjack rounds must be in INTERNAL_USDT, got ${input.currency}`,
    );
  }
}
