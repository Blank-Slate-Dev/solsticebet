// packages/games/plinko/src/limits.ts
//
// Plinko bet limits + input validation.
// See docs/PLINKO.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import type { PlinkoBetInput, PlinkoRisk, PlinkoRows } from './types.js';

export class PlinkoValidationError extends Error {
  override readonly name: string = 'PlinkoValidationError';
}

/** 0.01 INTERNAL_USDT */
export const MIN_STAKE: bigint = parseAmount('0.01');

/** Lower max stake than Dice/Mines because of the 1000× max multiplier. */
export const MAX_STAKE: bigint = parseAmount('100');

/** Max payout: stake (100) × max multiplier (1000) = 100,000. */
export const MAX_PAYOUT: bigint = parseAmount('100000');

/** Allowed row counts. */
export const ROWS_VALUES = [8, 12, 16] as const satisfies readonly PlinkoRows[];

/** Allowed risk levels. */
export const RISK_VALUES = ['low', 'medium', 'high'] as const satisfies readonly PlinkoRisk[];

export function assertValidStake(stake: bigint): void {
  if (typeof stake !== 'bigint') {
    throw new PlinkoValidationError('stake must be a bigint');
  }
  if (stake < MIN_STAKE) {
    throw new PlinkoValidationError('stake is below minimum');
  }
  if (stake > MAX_STAKE) {
    throw new PlinkoValidationError('stake exceeds maximum');
  }
}

export function assertValidRows(rows: number): asserts rows is PlinkoRows {
  if (!ROWS_VALUES.includes(rows as PlinkoRows)) {
    throw new PlinkoValidationError(`rows must be one of ${ROWS_VALUES.join(', ')}`);
  }
}

export function assertValidRisk(risk: string): asserts risk is PlinkoRisk {
  if (!RISK_VALUES.includes(risk as PlinkoRisk)) {
    throw new PlinkoValidationError(`risk must be one of ${RISK_VALUES.join(', ')}`);
  }
}

export function assertValidBetInput(input: PlinkoBetInput): void {
  if (typeof input.betId !== 'string' || input.betId.length === 0) {
    throw new PlinkoValidationError('betId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new PlinkoValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new PlinkoValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new PlinkoValidationError('houseAccountId must be a non-empty string');
  }
  assertValidStake(input.stake);
  assertValidRows(input.rows);
  assertValidRisk(input.risk);
  if (input.currency !== 'INTERNAL_USDT') {
    throw new PlinkoValidationError(`plinko bets must be in INTERNAL_USDT, got ${input.currency}`);
  }
}
