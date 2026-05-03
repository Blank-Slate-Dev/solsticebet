// packages/games/plinko/src/types.ts
//
// Types for the Plinko game.
// See docs/PLINKO.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * Supported row counts. 8/12/16 are the standard Stake-derivative options.
 */
export type PlinkoRows = 8 | 12 | 16;

/**
 * Risk levels alter the multiplier table; all share the same ~99% RTP.
 */
export type PlinkoRisk = 'low' | 'medium' | 'high';

/**
 * Inputs for a single Plinko bet.
 */
export interface PlinkoBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly rows: PlinkoRows;
  readonly risk: PlinkoRisk;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of a Plinko bet.
 */
export interface PlinkoBetOutcome {
  readonly betId: string;
  readonly path: readonly ('left' | 'right')[];
  readonly bucket: number;
  readonly rows: PlinkoRows;
  readonly risk: PlinkoRisk;
  readonly multiplier: number;
  readonly stake: bigint;
  /** Always non-negative. Zero if the bucket multiplier is zero. */
  readonly payout: bigint;
  /** True if payout > stake (player profits). */
  readonly isWin: boolean;
}
