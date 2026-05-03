// packages/games/baccarat/src/limits.ts
//
// Bet limits and input validation for Baccarat.
// See docs/BACCARAT.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import type { BaccaratBet, BaccaratCoupInput } from './types.js';

export class BaccaratValidationError extends Error {
  override readonly name: string = 'BaccaratValidationError';
}

/** Minimum stake per bet. */
export const MIN_BET_STAKE: bigint = parseAmount('0.01');

/** Maximum stake per bet. */
export const MAX_BET_STAKE: bigint = parseAmount('1000');

/** Maximum total stake across all bets in a single coup. */
export const MAX_COUP_STAKE: bigint = parseAmount('5000');

/** Maximum payout per coup (defence in depth). */
export const MAX_COUP_PAYOUT: bigint = parseAmount('50000');

/** Maximum number of distinct bet types per coup. */
export const MAX_BETS_PER_COUP = 3;

export function assertValidBet(bet: BaccaratBet): void {
  // Runtime type guard for callers that pass through unknown.
  const t = bet.type as unknown as string;
  if (t !== 'player' && t !== 'banker' && t !== 'tie') {
    throw new BaccaratValidationError(`bet type must be 'player', 'banker', or 'tie' (got '${t}')`);
  }
  if (typeof bet.stake !== 'bigint') {
    throw new BaccaratValidationError('bet.stake must be a bigint');
  }
  if (bet.stake < MIN_BET_STAKE) {
    throw new BaccaratValidationError('bet stake is below minimum');
  }
  if (bet.stake > MAX_BET_STAKE) {
    throw new BaccaratValidationError('bet stake exceeds maximum');
  }
}

export function assertValidCoupInput(input: BaccaratCoupInput): void {
  if (typeof input.coupId !== 'string' || input.coupId.length === 0) {
    throw new BaccaratValidationError('coupId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new BaccaratValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new BaccaratValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new BaccaratValidationError('houseAccountId must be a non-empty string');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new BaccaratValidationError(
      `baccarat coups must be in INTERNAL_USDT, got ${input.currency}`,
    );
  }

  const betsUnknown: unknown = input.bets;
  if (!Array.isArray(betsUnknown) || betsUnknown.length === 0) {
    throw new BaccaratValidationError('coup must have at least one bet');
  }
  const bets = betsUnknown as readonly BaccaratBet[];
  if (bets.length > MAX_BETS_PER_COUP) {
    throw new BaccaratValidationError(
      `coup has ${String(bets.length)} bets; max is ${String(MAX_BETS_PER_COUP)}`,
    );
  }

  // Reject duplicate bet types
  const typesSeen = new Set<string>();
  let totalStake = 0n;
  for (const bet of bets) {
    assertValidBet(bet);
    if (typesSeen.has(bet.type)) {
      throw new BaccaratValidationError(
        `duplicate bet type '${bet.type}' — use a single bet per type`,
      );
    }
    typesSeen.add(bet.type);
    totalStake += bet.stake;
  }
  /* v8 ignore next 3 -- defensive cap; unreachable given MAX_BETS_PER_COUP × MAX_BET_STAKE < MAX_COUP_STAKE */
  if (totalStake > MAX_COUP_STAKE) {
    throw new BaccaratValidationError('total coup stake exceeds maximum');
  }
}
