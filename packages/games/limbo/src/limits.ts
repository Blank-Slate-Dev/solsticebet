// packages/games/limbo/src/limits.ts

import { parseAmount } from '@solsticebet/ledger';

import type { LimboBetInput } from './types.js';

export class LimboValidationError extends Error {
  override readonly name: string = 'LimboValidationError';
}

export const MIN_STAKE: bigint = parseAmount('0.01');
export const MAX_STAKE: bigint = parseAmount('1000');
export const MIN_TARGET = 1.01;
export const MAX_TARGET = 1_000_000;
export const MAX_PAYOUT: bigint = parseAmount('100000');

export function assertValidBetInput(input: LimboBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new LimboValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new LimboValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new LimboValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new LimboValidationError('houseAccountId must be a non-empty string');
  }
  if (typeof input.stake !== 'bigint') {
    throw new LimboValidationError('stake must be a bigint');
  }
  if (input.stake < MIN_STAKE) {
    throw new LimboValidationError('stake is below minimum');
  }
  if (input.stake > MAX_STAKE) {
    throw new LimboValidationError('stake exceeds maximum');
  }
  if (!Number.isFinite(input.target)) {
    throw new LimboValidationError('target must be finite');
  }
  if (input.target < MIN_TARGET) {
    throw new LimboValidationError(`target must be at least ${String(MIN_TARGET)}`);
  }
  if (input.target > MAX_TARGET) {
    throw new LimboValidationError(`target must be at most ${String(MAX_TARGET)}`);
  }
  // Quantise to 0.01 precision
  const scaled = input.target * 100;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
    throw new LimboValidationError('target must be in 0.01 increments');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new LimboValidationError(`limbo bets must be in INTERNAL_USDT, got ${input.currency}`);
  }
}
