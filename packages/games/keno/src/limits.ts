// packages/games/keno/src/limits.ts

import { parseAmount } from '@solsticebet/ledger';

import type { KenoBetInput } from './types.js';
import { KENO_RISKS } from './tables.js';

export class KenoValidationError extends Error {
  override readonly name: string = 'KenoValidationError';
}

export const MIN_STAKE: bigint = parseAmount('0.01');
export const MAX_STAKE: bigint = parseAmount('100');
export const MIN_PICKS = 1;
export const MAX_PICKS = 10;
export const MAX_PAYOUT: bigint = parseAmount('100000');

export function assertValidBetInput(input: KenoBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new KenoValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new KenoValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new KenoValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new KenoValidationError('houseAccountId must be a non-empty string');
  }
  if (typeof input.stake !== 'bigint') {
    throw new KenoValidationError('stake must be a bigint');
  }
  if (input.stake < MIN_STAKE) {
    throw new KenoValidationError('stake is below minimum');
  }
  if (input.stake > MAX_STAKE) {
    throw new KenoValidationError('stake exceeds maximum');
  }
  if (input.currency !== 'INTERNAL_USDT') {
    throw new KenoValidationError(`keno bets must be in INTERNAL_USDT, got ${input.currency}`);
  }
  const picksUnknown: unknown = input.picks;
  if (!Array.isArray(picksUnknown)) {
    throw new KenoValidationError('picks must be an array');
  }
  const picks = picksUnknown as readonly number[];
  if (picks.length < MIN_PICKS || picks.length > MAX_PICKS) {
    throw new KenoValidationError(`must pick ${String(MIN_PICKS)}..${String(MAX_PICKS)} numbers`);
  }
  const seen = new Set<number>();
  for (const p of picks) {
    if (!Number.isInteger(p) || p < 1 || p > 80) {
      throw new KenoValidationError('each pick must be an integer in [1, 80]');
    }
    if (seen.has(p)) {
      throw new KenoValidationError(`duplicate pick: ${String(p)}`);
    }
    seen.add(p);
  }
  if (!KENO_RISKS.includes(input.risk)) {
    throw new KenoValidationError(`risk must be one of ${KENO_RISKS.join(', ')}`);
  }
}
