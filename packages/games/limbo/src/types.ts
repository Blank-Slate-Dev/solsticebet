// packages/games/limbo/src/types.ts

import type { Currency } from '@solsticebet/ledger';

export interface LimboBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  /** Target multiplier (1.01 .. 1,000,000). Win if RNG result >= target. */
  readonly target: number;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LimboBetOutcome {
  readonly betId: string;
  readonly result: number;
  readonly target: number;
  readonly stake: bigint;
  readonly isWin: boolean;
  readonly payout: bigint;
}
