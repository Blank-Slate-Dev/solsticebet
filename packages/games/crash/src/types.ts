// packages/games/crash/src/types.ts
//
// Types for the Crash game (single-player v1).
// See docs/CRASH.md.

import type { Currency } from '@solsticebet/ledger';

/**
 * Inputs for a Crash bet.
 */
export interface CrashBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  /** The multiplier at which the player auto-cashes out (1.01 .. MAX_AUTO_CASHOUT). */
  readonly autoCashOut: number;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Outcome of a Crash bet.
 */
export interface CrashBetOutcome {
  readonly betId: string;
  /** The bust multiplier (>= 1.00). */
  readonly bustAt: number;
  readonly autoCashOut: number;
  readonly stake: bigint;
  readonly isWin: boolean;
  /** Always non-negative. Zero on loss. */
  readonly payout: bigint;
}
