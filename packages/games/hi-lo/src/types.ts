// packages/games/hi-lo/src/types.ts

import type { Currency } from '@solsticebet/ledger';

export type HiLoPick = 'higher_or_equal' | 'lower_or_equal';

export type HiLoRoundState = 'active' | 'cashed_out' | 'busted';

export interface StartHiLoRoundInput {
  readonly roundId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface HiLoRound {
  readonly roundId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  /** Card ranks in draw order. Index 0 is starting card. */
  readonly cards: readonly number[];
  /** Player picks made so far. cards.length - 1 picks total. */
  readonly picks: readonly HiLoPick[];
  readonly currentMultiplier: number;
  readonly state: HiLoRoundState;
  readonly payout: bigint | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}
