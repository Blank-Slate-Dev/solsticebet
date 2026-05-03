// packages/games/keno/src/types.ts

import type { Currency } from '@solsticebet/ledger';

export type KenoRisk = 'low' | 'medium' | 'high' | 'classic';

export interface KenoBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  /** 1-10 unique numbers in [1, 80]. */
  readonly picks: readonly number[];
  readonly risk: KenoRisk;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface KenoBetOutcome {
  readonly betId: string;
  readonly drawn: readonly number[]; // 20 numbers
  readonly picks: readonly number[];
  readonly hits: number; // count of picks that appear in drawn
  readonly multiplier: number;
  readonly stake: bigint;
  readonly isWin: boolean;
  readonly payout: bigint;
}
