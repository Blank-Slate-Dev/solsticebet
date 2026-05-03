// packages/games/coin-flip/src/limits.ts

import { parseAmount } from '@solsticebet/ledger';

import type { CoinFlipBetInput } from './types.js';

export class CoinFlipValidationError extends Error {
  override readonly name: string = 'CoinFlipValidationError';
}

export const MIN_STAKE: bigint = parseAmount('0.01');
export const MAX_STAKE: bigint = parseAmount('1000');
export const MAX_PAYOUT: bigint = parseAmount('2000');
/** 1.96:1 payout — 2% house edge on a 50/50 flip. Standard for crypto casinos. */
export const PAYOUT_MULTIPLIER = 1.96;

export function assertValidBetInput(input: CoinFlipBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new CoinFlipValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new CoinFlipValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new CoinFlipValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new CoinFlipValidationError('houseAccountId must be a non-empty string');
  }
  if (typeof input.stake !== 'bigint') {
    throw new CoinFlipValidationError('stake must be a bigint');
  }
  if (input.stake < MIN_STAKE) {
    throw new CoinFlipValidationError('stake is below minimum');
  }
  if (input.stake > MAX_STAKE) {
    throw new CoinFlipValidationError('stake exceeds maximum');
  }
  const pickU = input.pick as unknown as string;
  if (pickU !== 'heads' && pickU !== 'tails') {
    throw new CoinFlipValidationError("pick must be 'heads' or 'tails'");
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new CoinFlipValidationError(
      `coin flip bets must be in INTERNAL_USDT, got ${input.currency}`,
    );
  }
}
