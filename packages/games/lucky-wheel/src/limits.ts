// packages/games/lucky-wheel/src/limits.ts

import { parseAmount } from '@solsticebet/ledger';

import type { LuckyWheelBetInput } from './types.js';

export class LuckyWheelValidationError extends Error {
  override readonly name: string = 'LuckyWheelValidationError';
}

export const MIN_STAKE: bigint = parseAmount('0.01');
export const MAX_STAKE: bigint = parseAmount('1000');
export const MAX_PAYOUT: bigint = parseAmount('60000'); // 1000 × 50 + headroom

export function assertValidBetInput(input: LuckyWheelBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new LuckyWheelValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new LuckyWheelValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new LuckyWheelValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new LuckyWheelValidationError('houseAccountId must be a non-empty string');
  }
  if (typeof input.stake !== 'bigint') {
    throw new LuckyWheelValidationError('stake must be a bigint');
  }
  if (input.stake < MIN_STAKE) {
    throw new LuckyWheelValidationError('stake is below minimum');
  }
  if (input.stake > MAX_STAKE) {
    throw new LuckyWheelValidationError('stake exceeds maximum');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new LuckyWheelValidationError(
      `lucky wheel bets must be in INTERNAL_USDT, got ${input.currency}`,
    );
  }
}
