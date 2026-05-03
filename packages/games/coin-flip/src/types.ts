// packages/games/coin-flip/src/types.ts

import type { Currency } from '@solsticebet/ledger';

export type CoinSide = 'heads' | 'tails';

export interface CoinFlipBetInput {
  readonly betId: string;
  readonly userAccountId: string;
  readonly escrowAccountId: string;
  readonly houseAccountId: string;
  readonly stake: bigint;
  readonly pick: CoinSide;
  readonly currency: Currency;
  readonly serverSeed: string;
  readonly clientSeed: string;
  readonly nonce: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CoinFlipBetOutcome {
  readonly betId: string;
  readonly result: CoinSide;
  readonly pick: CoinSide;
  readonly stake: bigint;
  readonly isWin: boolean;
  readonly payout: bigint;
}
