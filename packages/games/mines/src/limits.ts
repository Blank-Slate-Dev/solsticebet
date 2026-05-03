// packages/games/mines/src/limits.ts
//
// Mines bet limits + input validation.
// See docs/MINES.md § 3.

import { parseAmount } from '@solsticebet/ledger';

import { TOTAL_TILES } from './math.js';
import type { StartMinesRoundInput } from './types.js';

export class MinesValidationError extends Error {
  override readonly name: string = 'MinesValidationError';
}

/** Minimum stake. 0.01 INTERNAL_USDT. */
export const MIN_STAKE: bigint = parseAmount('0.01');

/** Maximum stake (default tier). 1000 INTERNAL_USDT. */
export const MAX_STAKE: bigint = parseAmount('1000');

/** Maximum payout per round — defence in depth. */
export const MAX_PAYOUT: bigint = parseAmount('49500');

/** Tile count is fixed in v1. */
export const GRID_SIZE = TOTAL_TILES;

/** Mine count bounds. */
export const MIN_MINE_COUNT = 1;
export const MAX_MINE_COUNT = 24;

export function assertValidStake(stake: bigint): void {
  if (typeof stake !== 'bigint') {
    throw new MinesValidationError('stake must be a bigint');
  }
  if (stake < MIN_STAKE) {
    throw new MinesValidationError('stake is below minimum');
  }
  if (stake > MAX_STAKE) {
    throw new MinesValidationError('stake exceeds maximum');
  }
}

export function assertValidMineCount(mineCount: number): void {
  if (!Number.isInteger(mineCount)) {
    throw new MinesValidationError('mineCount must be an integer');
  }
  if (mineCount < MIN_MINE_COUNT || mineCount > MAX_MINE_COUNT) {
    throw new MinesValidationError(
      `mineCount must be between ${String(MIN_MINE_COUNT)} and ${String(MAX_MINE_COUNT)}`,
    );
  }
}

export function assertValidTileIndex(tileIndex: number): void {
  if (!Number.isInteger(tileIndex)) {
    throw new MinesValidationError('tileIndex must be an integer');
  }
  if (tileIndex < 0 || tileIndex >= GRID_SIZE) {
    throw new MinesValidationError(`tileIndex must be in [0, ${String(GRID_SIZE)})`);
  }
}

export function assertValidStartInput(input: StartMinesRoundInput): void {
  if (typeof input.roundId !== 'string' || input.roundId.length === 0) {
    throw new MinesValidationError('roundId must be a non-empty string');
  }
  if (typeof input.userAccountId !== 'string' || input.userAccountId.length === 0) {
    throw new MinesValidationError('userAccountId must be a non-empty string');
  }
  if (typeof input.escrowAccountId !== 'string' || input.escrowAccountId.length === 0) {
    throw new MinesValidationError('escrowAccountId must be a non-empty string');
  }
  if (typeof input.houseAccountId !== 'string' || input.houseAccountId.length === 0) {
    throw new MinesValidationError('houseAccountId must be a non-empty string');
  }
  assertValidStake(input.stake);
  assertValidMineCount(input.mineCount);
  if (input.currency !== 'INTERNAL_USDT') {
    throw new MinesValidationError(`mines bets must be in INTERNAL_USDT, got ${input.currency}`);
  }
}
