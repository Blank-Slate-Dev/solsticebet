// packages/games/hi-lo/src/limits.ts

import { parseAmount } from '@solsticebet/ledger';

import type { StartHiLoRoundInput } from './types.js';

export class HiLoValidationError extends Error {
  override readonly name: string = 'HiLoValidationError';
}

export const MIN_STAKE: bigint = parseAmount('0.01');
export const MAX_STAKE: bigint = parseAmount('100');
export const MAX_PAYOUT: bigint = parseAmount('100000');
/** Maximum number of consecutive picks within a round (caps multiplier blowups). */
export const MAX_PICKS = 25;

export function assertValidStartInput(input: StartHiLoRoundInput): void {
  if (typeof input.roundId !== 'string' || input.roundId.length === 0) {
    throw new HiLoValidationError('roundId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new HiLoValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new HiLoValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new HiLoValidationError('houseAccountId must be a non-empty string');
  }
  if (typeof input.stake !== 'bigint') {
    throw new HiLoValidationError('stake must be a bigint');
  }
  if (input.stake < MIN_STAKE) {
    throw new HiLoValidationError('stake is below minimum');
  }
  if (input.stake > MAX_STAKE) {
    throw new HiLoValidationError('stake exceeds maximum');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new HiLoValidationError(`hi-lo rounds must be in INTERNAL_USDT, got ${input.currency}`);
  }
}
